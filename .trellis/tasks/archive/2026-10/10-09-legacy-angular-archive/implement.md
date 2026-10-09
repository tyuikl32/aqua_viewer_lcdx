# implement.md — Progress Tracker

## Result: COMPLETE — one push, nothing else touched

### Command run

```bash
git push origin legacy-angular:legacy-angular
```

Explicit refspec (`local:remote`), deliberately **not** `git push --all` and **not** relying on
`push.default` — so only this one branch could possibly move. Output:

```
 * [new branch]      legacy-angular -> legacy-angular
```

### Before / after SHA comparison

| Branch | Before | After | Moved? |
|---|---|---|---|
| `master` | `b1c3fb45e5bddef32608946e2a28a7442639b018` | `b1c3fb45e5bddef32608946e2a28a7442639b018` | ❌ no |
| `legacy-angular` | `b1c3fb45e5bddef32608946e2a28a7442639b018` | `b1c3fb45e5bddef32608946e2a28a7442639b018` | ❌ no (local) |
| `backup` | `99029d7834003bc24e04b5ac8c81b3548cde7eb5` | `99029d7834003bc24e04b5ac8c81b3548cde7eb5` | ❌ no |
| `test/lcdx-react-port-audit` | `a878d287ca8bf2a136496e04f059fe4409820c6d` | `a878d287ca8bf2a136496e04f059fe4409820c6d` | ❌ no |

### Remote state after the push

```
90ed95b…  refs/heads/backup
b1c3fb4…  refs/heads/legacy-angular   ← NEW
b1c3fb4…  refs/heads/master
ce5c9cf…  refs/heads/sdez160
a878d28…  refs/heads/test/lcdx-react-port-audit
```

Note `origin/backup` is still at `90ed95b` while the local `backup` is at `99029d7` — **left as-is on
purpose**. Syncing it would have been an unrequested second change; it is also harmless because
`backup` is a read-only upstream mirror and the local copy is the authoritative one for our work.

### Side note on remote size

`origin/backup` at `90ed95b` predates the 7-commit increment ported earlier today. Not a problem —
`backup` is never used as a fetch source; upstream is fetched via the `upstream` remote.

## Notes

- Do not run `dotnet` from Bash. `py -3` is the working Python.
- Git network on this machine goes through an unstable proxy; if a push/fetch fails with
  `schannel: failed to receive handshake`, retry, or use
  `CURL_CA_BUNDLE=/ucrt64/etc/ssl/certs/ca-bundle.crt git -c http.sslBackend=openssl -c http.proxy=http://127.0.0.1:7897 …`
- Standing instruction: this session commits only, no push — **except** the one branch explicitly
  requested here.
