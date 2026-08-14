# GenLayer Submission Release Checklist

## Automated Gates

- [ ] `npm audit --omit=dev`
- [ ] `npm run verify:deployed-source`
- [ ] `npm run lint:contract`
- [ ] `python -m pytest tests/direct -q`
- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test:e2e -- --project=desktop`
- [ ] GitHub Actions frontend, contract, and desktop E2E jobs are green

## Reviewer Truth

- [ ] Live dApp uses `0xF85C4460B8195F9ebFD7b376c852aD7E89Ffe63D`
- [ ] Deployment and settlement links in `docs/DEPLOYMENT.md` resolve
- [ ] Repository contract source hash matches the deployed-source proof
- [ ] Paid and refunded histories remain visible from public contract views
- [ ] Limitations in `SECURITY.md` remain accurate
- [ ] Submission describes a two-wallet Bradbury pilot, not external adoption

## Hygiene

- [ ] No `.env`, private key, seed phrase, runtime log, test artifact, or generated video is tracked
- [ ] Working tree is clean
- [ ] Final diff contains no unintended contract, runtime config, or snapshot change
- [ ] Demo video is uploaded manually before adding any public video URL
- [ ] Create `v1.0.0 - GenLayer Submission` only after all checks pass
