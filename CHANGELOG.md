# [3.2.0](https://github.com/fgiova/sqs-consumer/compare/3.1.0...3.2.0) (2026-05-08)


### Features

* update dependencies to latest versions in package.json and package-lock.json ([8a7645e](https://github.com/fgiova/sqs-consumer/commit/8a7645ee55292338993e53473604782e298ab2e1))

# [3.1.0](https://github.com/fgiova/sqs-consumer/compare/3.0.0...3.1.0) (2026-05-07)


### Bug Fixes

* prevent unhandled rejections for late handler errors after timeout ([f3e2d05](https://github.com/fgiova/sqs-consumer/commit/f3e2d05707c41b790b8847415a4f4f77cde4f303))


### Features

* expose AbortSignal to message handlers via getAbortSignal() ([2aea512](https://github.com/fgiova/sqs-consumer/commit/2aea512582980f14afb939fa3e406128c085c3e9))

# [3.0.0](https://github.com/fgiova/sqs-consumer/compare/2.2.1...3.0.0) (2026-02-12)

## [2.2.1](https://github.com/fgiova/sqs-consumer/compare/2.2.0...2.2.1) (2025-09-08)


### Bug Fixes

* better support to undici mocks ([6f208d4](https://github.com/fgiova/sqs-consumer/commit/6f208d45b633e9a0edcc84b6293a0ed83f3eeb80))

# [2.2.0](https://github.com/fgiova/sqs-consumer/compare/2.1.4...2.2.0) (2025-09-08)


### Features

* update aws-signature dependency ([28781d8](https://github.com/fgiova/sqs-consumer/commit/28781d8c559092717962ccff7b15f298baee7bdc))

## [2.1.4](https://github.com/fgiova/sqs-consumer/compare/2.1.3...2.1.4) (2025-09-04)


### Bug Fixes

* fix delete after consume messages ([f12128e](https://github.com/fgiova/sqs-consumer/commit/f12128e6bb420f1874779c3ce4b6d735551908c8))

## [2.1.3](https://github.com/fgiova/sqs-consumer/compare/2.1.2...2.1.3) (2025-09-03)


### Bug Fixes

* update aws-signature dependency ([62bc516](https://github.com/fgiova/sqs-consumer/commit/62bc5167d39f6beae48b8e041c3a22e8281a3af9))

## [2.1.2](https://github.com/fgiova/sqs-consumer/compare/2.1.1...2.1.2) (2025-09-03)


### Bug Fixes

* fix cjs exports ([51030e2](https://github.com/fgiova/sqs-consumer/commit/51030e2a1acf3cbaee63be1d4b01aa0f8240ac3a))

## [2.1.1](https://github.com/fgiova/sqs-consumer/compare/2.1.0...2.1.1) (2025-09-03)


### Bug Fixes

* fix hook types and add attributeNames to consumer options ([50fee57](https://github.com/fgiova/sqs-consumer/commit/50fee5747f16d58f6ba4da7157d5f4a52e0969af))

# [2.1.0](https://github.com/fgiova/sqs-consumer/compare/2.0.1...2.1.0) (2025-09-02)


### Features

* update dependencies ([35a4abc](https://github.com/fgiova/sqs-consumer/commit/35a4abce94b464edbc898f11757b2a2b847269d9))

## [2.0.1](https://github.com/fgiova/sqs-consumer/compare/2.0.0...2.0.1) (2025-03-07)


### Bug Fixes

* constraint on package.json ([47584b2](https://github.com/fgiova/sqs-consumer/commit/47584b279c76ecd19cb3d86d3f0ef34225131672))

# [2.0.0](https://github.com/fgiova/sqs-consumer/compare/1.0.0...2.0.0) (2025-03-07)


### Bug Fixes

* fix documentation ([b585f30](https://github.com/fgiova/sqs-consumer/commit/b585f3071aa3889549befb4ebbfa31679aea94a2))
* fix minimum node version ([cf03143](https://github.com/fgiova/sqs-consumer/commit/cf03143964d0e6a307f75ac4156f3569e458333b))
* fix minimum node version ([ad316d3](https://github.com/fgiova/sqs-consumer/commit/ad316d3847f11dd87f524f70d860cb14d3d7f80f))
* Fix Promise.race memory leak using @watchable/unpromise ([377b29c](https://github.com/fgiova/sqs-consumer/commit/377b29c90dfb1950f816dd5c9481d94eabf0cee9))

# 1.0.0 (2024-01-08)


### Features

* release ([07be175](https://github.com/fgiova/sqs-consumer/commit/07be175159aeedc3d00791edde58d1f6bb5a6cfc))
