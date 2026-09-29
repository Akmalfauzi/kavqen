"""Run with python -m unittest app.test_knowledge inside the AI image."""
import unittest
from unittest.mock import patch
from qdrant_client import QdrantClient, models
from app import knowledge


class KnowledgeTests(unittest.TestCase):
    def test_semantic_search_owner_scope_update_and_delete(self):
        db = QdrantClient(':memory:')
        db.create_collection(knowledge.COLLECTION, vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE))
        with patch.object(knowledge, 'client', return_value=db):
            knowledge.index_document('clinic', knowledge.Document(ownerId='alice', title='Clinic hours', content='The clinic reception opens Monday at nine in the morning.'))
            knowledge.index_document('support', knowledge.Document(ownerId='alice', title='Customer service', content='Damaged orders can be reviewed for replacement.'))
            knowledge.index_document('secret', knowledge.Document(ownerId='bob', title='Clinic hours', content='The clinic reception opens Monday at nine in the morning. Private Bob record.'))
            hits = knowledge.search(knowledge.Query(ownerId='alice', query='When does the medical office open?'))['data']
            self.assertEqual(hits[0]['documentId'], 'clinic')
            self.assertTrue(all(hit['ownerId'] == 'alice' for hit in hits))
            knowledge.index_document('clinic', knowledge.Document(ownerId='alice', title='Clinic hours', content='Reception now opens at ten on Tuesday.'))
            rows, _ = db.scroll(knowledge.COLLECTION, scroll_filter=models.Filter(must=knowledge.scope('alice', 'clinic')))
            self.assertEqual(len(rows), 1)
            self.assertIn('Tuesday', rows[0].payload['content'])
            knowledge.delete_document('clinic', ownerId='alice')
            rows, _ = db.scroll(knowledge.COLLECTION, scroll_filter=models.Filter(must=knowledge.scope('alice', 'clinic')))
            self.assertEqual(rows, [])
            self.assertRaises(Exception, knowledge.authorize, 'invalid-token')
        db.close()
