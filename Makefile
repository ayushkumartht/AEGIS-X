.PHONY: dev test typecheck build clean

dev:
	powershell -File scripts/dev.ps1

test:
	cd backend && python -m pytest -q

typecheck:
	cd frontend && npx tsc -b

build:
	cd frontend && npm run build

clean:
	find . -type d -name __pycache__ -not -path "./.venv/*" -exec rm -rf {} + 2>/dev/null || true
