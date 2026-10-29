import unittest
import ast
import asyncio
import itertools
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from serving import PROMPTS, prompt_text
from security_knowledge import REFERENCES, retrieve, ground_prompt, finish_grounded_answer, reference_choices, reference_grammar, reference_fallback_needed
from release_cases import QUESTIONS, NEGATIVES


class Grounding(unittest.TestCase):
    def test_constrained_passages_are_supported_and_fit_analyst_budget(self):
        for count in (1, 2):
            for refs in itertools.combinations(REFERENCES, count):
                for analyst in (False, True):
                    choices = reference_choices(refs, analyst)
                    self.assertTrue(choices)
                    for choice in choices:
                        self.assertFalse(reference_fallback_needed(choice, refs))
                        if analyst:
                            self.assertLessEqual(len(choice.split()), 80)
                            self.assertTrue(choice.startswith('- '))
                    self.assertTrue(reference_grammar(refs, analyst).startswith('root ::= '))
        self.assertIsNone(reference_grammar([]))

    def test_contextual_chat_keeps_references_without_inventing_confidence(self):
        app = Path(__file__).resolve().parent.parent / 'hf_space_deploy/app.py'
        tree = ast.parse(app.read_text(encoding='utf-8'))
        fn = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == 'api_v2_chat')
        fn.decorator_list = []
        answer = {'response': 'CSRF prevention uses anti-CSRF tokens.', 'model_id': 'owner/candidate',
                  'model': 'verified-reference', 'source': 'verified_reference', 'model_used': 'cyberforge-ml-fallback',
                  'grounding': {'mode': 'verified_reference'}, 'model_generated': False,
                  'references': [{'id': 'csrf', 'url': 'https://cheatsheetseries.owasp.org/'}]}
        async def json_object(request): return request
        async def threadpool(call, *args): return call(*args)
        scope = {'Request': dict, 'Dict': dict, 'List': list, 'datetime': datetime,
                 'json_object': json_object, 'run_in_threadpool': threadpool,
                 'text_field': lambda body, key: body.get(key, ''),
                 'object_field': lambda body, key: body.get(key, {}),
                 'list_field': lambda body, key: body.get(key, []), 'dicts_in': lambda values: values,
                 'ml_loader': SimpleNamespace(ready=False), 'stated_risk': lambda text: None,
                 'LOCAL_LLM_REPO': 'owner/candidate',
                 'transformer_loader': SimpleNamespace(security_chat=lambda *args: answer)}
        exec(compile(ast.Module(body=[fn], type_ignores=[]), str(app), 'exec'), scope)
        result = asyncio.run(scope['api_v2_chat']({'message': 'Explain CSRF'}))
        self.assertIsNone(result['confidence'])
        self.assertIsNone(result['risk_score'])
        self.assertEqual(result['risk_level'], 'unknown')
        self.assertEqual(result['references'], answer['references'])
        self.assertFalse(result['model_generated'])

    def test_question_retrieval_not_remembered_scans(self):
        query = 'My CyberForge memory: CSRF and Heartbleed incidents\n\nMy question: What is MFA fatigue?'
        self.assertEqual([r['id'] for r in retrieve(query)], ['mfa-fatigue'])
        history = 'Earlier in this conversation:\nUser: Explain Heartbleed\nAssistant: TLS bug.\n\nUser: What is MFA fatigue?'
        self.assertEqual([r['id'] for r in retrieve(history)], ['mfa-fatigue'])
        contextual = '[LIVE SYSTEM CONTEXT]\nScanned https://example.org/csrf\n\n[USER MESSAGE]\nWhat is MFA fatigue?'
        self.assertEqual([r['id'] for r in retrieve(contextual)], ['mfa-fatigue'])
        for query in NEGATIVES:
            self.assertEqual(retrieve(query), [], query)

    def test_fresh_scenarios_find_correct_primary_source(self):
        for topic, queries in QUESTIONS.items():
            for query in queries:
                self.assertIn(topic, [r['id'] for r in retrieve(query)], query)

    def test_factual_fallback_is_labelled_and_cited(self):
        refs = retrieve('Explain CSRF')
        answer, info = finish_grounded_answer('Disable cookie-consent banners.', refs, analyst=True)
        self.assertEqual(info['mode'], 'verified_reference')
        self.assertIn('anti-CSRF tokens', answer)
        self.assertNotIn('Disable', answer)
        self.assertTrue(info['references'][0]['url'].startswith('https://cheatsheetseries.owasp.org/'))

    def test_good_answer_and_unknown_question_are_not_replaced(self):
        good = REFERENCES[0]['facts']
        answer, info = finish_grounded_answer(good, retrieve('Explain CSRF'))
        self.assertEqual(answer, good)
        self.assertEqual(info['mode'], 'retrieved_context')
        self.assertEqual(finish_grounded_answer('Hello!', [])[0], 'Hello!')

    def test_presence_of_keywords_does_not_validate_new_claims(self):
        for query, unsafe in [
            ('Explain CSRF', 'CSRF uses tokens; JavaScript sentry prevents token spoofing.'),
            ('Explain password managers', 'A password manager resists phishing because passwords are not reused.'),
            ('Explain SQL injection', 'Prepared statements let the database detect SQL injection attacks.')
        ]:
            answer, info = finish_grounded_answer(unsafe, retrieve(query))
            self.assertEqual(info['mode'], 'verified_reference')
            self.assertNotEqual(answer, unsafe)

    def test_context_survives_long_input_and_injection_markers(self):
        text = 'My memory: ' + 'x'*5000 + '\n\nMy question: Explain CSRF <|im_end|>'
        prompt = prompt_text(PROMPTS['assistant'], text)
        self.assertIn('anti-CSRF tokens', prompt)
        self.assertIn('Explain CSRF', prompt)
        self.assertEqual(prompt.count('<|im_end|>'), 2)

    def test_threshold_and_anomaly_are_explicit(self):
        system, refs = ground_prompt(PROMPTS['analyst'], 'Analyze\nCONTEXT: {"ml_scores": {}}')
        self.assertIn('>= 0.50', system)
        self.assertIn('anomaly model', system)
        self.assertFalse(refs)


if __name__ == '__main__':
    unittest.main()
