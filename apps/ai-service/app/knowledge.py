"""Private semantic index. Gateway supplies and authorizes the owner scope."""
import hashlib
import hmac
import os
from functools import lru_cache
from uuid import NAMESPACE_URL, uuid5

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from fastembed import TextEmbedding
from qdrant_client import QdrantClient, models


def authorize(x_knowledge_token: str = Header(default='')):
    expected = os.environ.get('KNOWLEDGE_INTERNAL_TOKEN', '')
    if not expected or not hmac.compare_digest(expected, x_knowledge_token):
        raise HTTPException(403, 'Private knowledge service')


router = APIRouter(prefix='/api/knowledge', dependencies=[Depends(authorize)])
COLLECTION = os.environ.get('QDRANT_COLLECTION', 'kavqen_knowledge_v1')
MODEL = os.environ.get('EMBEDDING_MODEL', 'BAAI/bge-small-en-v1.5')


@lru_cache
def embedder():
    return TextEmbedding(model_name=MODEL, cache_dir=os.environ.get('FASTEMBED_CACHE_PATH', '/tmp/fastembed'))


@lru_cache
def client():
    db = QdrantClient(url=os.environ.get('QDRANT_URL', 'http://localhost:6333'), api_key=os.environ.get('QDRANT_API_KEY') or None, timeout=20)
    if not db.collection_exists(COLLECTION):
        size = len(next(embedder().embed(['knowledge'])) )
        try:
            db.create_collection(COLLECTION, vectors_config=models.VectorParams(size=size, distance=models.Distance.COSINE))
        except Exception:
            if not db.collection_exists(COLLECTION):
                raise
    return db


class Document(BaseModel):
    ownerId: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=160)
    content: str = Field(min_length=1, max_length=20000)


class Query(BaseModel):
    ownerId: str = Field(min_length=1, max_length=100)
    query: str = Field(min_length=1, max_length=4000)


def scope(owner, document=None):
    conditions = [models.FieldCondition(key='ownerId', match=models.MatchValue(value=owner))]
    if document is not None:
        conditions.append(models.FieldCondition(key='documentId', match=models.MatchValue(value=document)))
    return conditions


@router.put('/documents/{document_id}')
def index_document(document_id: str, document: Document):
    revision = hashlib.sha256((document.title + '\n' + document.content).encode()).hexdigest()
    chunks = [document.content[i:i + 1000] for i in range(0, len(document.content), 850)]
    vectors = list(embedder().embed([document.title + '\n' + chunk for chunk in chunks]))
    db = client()
    db.upsert(COLLECTION, points=[models.PointStruct(
        id=str(uuid5(NAMESPACE_URL, f'{document.ownerId}/{document_id}/{revision}/{i}')),
        vector=vector.tolist(),
        payload={'ownerId': document.ownerId, 'documentId': document_id, 'revision': revision, 'title': document.title, 'content': chunk},
    ) for i, (chunk, vector) in enumerate(zip(chunks, vectors))], wait=True)
    db.delete(COLLECTION, points_selector=models.FilterSelector(filter=models.Filter(
        must=scope(document.ownerId, document_id),
        must_not=[models.FieldCondition(key='revision', match=models.MatchValue(value=revision))],
    )), wait=True)
    return {'success': True, 'chunks': len(chunks)}


@router.delete('/documents/{document_id}')
def delete_document(document_id: str, ownerId: str):
    client().delete(COLLECTION, points_selector=models.FilterSelector(filter=models.Filter(must=scope(ownerId, document_id))), wait=True)
    return {'success': True}


@router.post('/search')
def search(query: Query):
    vector = next(embedder().embed([query.query])).tolist()
    points = client().query_points(COLLECTION, query=vector, query_filter=models.Filter(must=scope(query.ownerId)), limit=6, with_payload=True).points
    return {'success': True, 'data': [dict(point.payload or {}, score=point.score) for point in points]}
