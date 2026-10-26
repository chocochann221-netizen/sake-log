"""Read-only live boundary checks; never authenticate as an existing user.

Run explicitly: python3 tests/live_anonymous_checks.py --output /tmp/sake-live.json
This suite is not part of the mocked Node suite. Nonzero exit means a failed
boundary/configuration check, not necessarily unauthorized data access.
"""
import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import urllib.error
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    source = (Path(__file__).resolve().parents[1] / 'app.js').read_text()
    base = re.search(r'const BASE = "([^"]+)"', source)[1]
    key = re.search(r'const PUBLISHABLE_KEY = "([^"]+)"', source)[1]
    results = []

    def request(path, method='GET', headers=None, data=None):
        req = urllib.request.Request(base + path, method=method, data=data,
                                     headers={'apikey': key, **(headers or {})})
        try:
            response = urllib.request.urlopen(req, timeout=20)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read() if method != 'HEAD' else b''
            return response.status, response.headers, json.loads(raw) if raw else None

    def check(name, operation):
        try:
            result = operation()
        except Exception as error:
            # Do not dump URLs, headers, tokens, database errors, or response rows.
            result = {'pass': False, 'error_type': type(error).__name__}
        results.append({'check': name, **result})

    def settings():
        status, _, body = request('/auth/v1/settings')
        expected = {'email': True, 'google': True, 'apple': False, 'anonymous_users': False}
        observed = {name: body.get('external', {}).get(name) for name in expected}
        confirmed = body.get('mailer_autoconfirm') is False
        return {'status': status, 'providers': observed, 'email_confirmation_required': confirmed,
                'pass': status == 200 and observed == expected and confirmed}

    check('auth_configuration', settings)

    for table in ['profiles', 'brewery_contact_private', 'brewery_links',
                  'line_account_links', 'personal_data_export_requests']:
        def permission_check(table=table):
            # limit=0 cannot return production rows even if permissions regress.
            status, _, body = request('/rest/v1/' + table + '?select=*&limit=0')
            code = body.get('code') if isinstance(body, dict) else None
            return {'status': status, 'error_code': code,
                    'pass': status in [401, 403] and code == '42501'}
        check('anon_denied_' + table, permission_check)

    for table in ['drinking_records', 'sake_photos']:
        def count_check(table=table):
            # HEAD exposes only an aggregate count, never record or photo data.
            status, headers, _ = request('/rest/v1/' + table + '?select=id', 'HEAD',
                                         {'Prefer': 'count=exact', 'Range': '0-0'})
            count = headers.get('Content-Range', '').split('/')[-1]
            return {'status': status, 'visible_rows': count,
                    'pass': status in [401, 403] or (status == 200 and count == '0')}
        check('anon_no_visible_' + table, count_check)

    for function, body in [('delete-account', {}),
                           ('personal-data-export', {'action': 'status'}),
                           ('line-login', {})]:
        def function_check(function=function, body=body):
            status, _, response = request('/functions/v1/' + function, 'POST',
                                          {'Content-Type': 'application/json'},
                                          json.dumps(body).encode())
            result = {'status': status, 'pass': status in [401, 403]}
            if function == 'delete-account' and status == 500:
                result['matches_original_missing_auth_throw'] = (
                    isinstance(response, dict) and response.get('error') == 'login required')
            return result
        check('unauthenticated_' + function, function_check)

    output = {
        'observed_at': datetime.now(timezone(timedelta(hours=9))).isoformat(),
        'scope': 'live anonymous boundaries only; no A/B ownership claim',
        'passed': sum(result['pass'] for result in results),
        'failed': sum(not result['pass'] for result in results),
        'results': results,
    }
    if args.output:
        args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 1 if output['failed'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
