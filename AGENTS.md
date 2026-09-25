# Project architecture rules

- Keep eBay notification public-key normalization and raw-body signature verification in the shared notification helper so endpoint behavior and regression tests use the same cryptographic path.