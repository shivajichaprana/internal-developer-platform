# Entry points for working on the platform configuration.
#
# The heavy lifting lives in the validation harness (vitest) and the TechDocs
# toolchain; this Makefile provides memorable, CI-consistent wrappers around
# them so local checks match what the pipeline runs.

SHELL := /bin/bash

NPM      ?= npm
YAMLLINT ?= yamllint

# Same YAML file set the pipeline lints. Skeleton *.njk files are excluded by
# design: they are nunjucks templates, not valid YAML until rendered.
YAML_TARGETS := app-config.yaml mkdocs.yml catalog/ permissions/policy.yaml templates/microservice/template.yaml

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install: ## Install the validation harness dependencies
	$(NPM) install

.PHONY: typecheck
typecheck: ## Type-check the validation suite
	$(NPM) run typecheck

.PHONY: test
test: ## Run the entity/template/policy validation suite
	$(NPM) test

.PHONY: validate
validate: typecheck test ## Type-check and run the full validation suite

.PHONY: lint
lint: ## Lint YAML sources (matches the CI file set)
	$(YAMLLINT) -d "{extends: relaxed, rules: {line-length: disable}}" $(YAML_TARGETS)

.PHONY: serve
serve: ## Preview the platform's TechDocs site locally
	npx @techdocs/cli serve --no-docker

.PHONY: clean
clean: ## Remove installed dependencies and generated site output
	rm -rf node_modules site
