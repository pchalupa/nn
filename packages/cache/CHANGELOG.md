# @goodstate/cache

## 7.0.2

### Patch Changes

- 089a06c: Releases are now built and published by GitHub Actions with a provenance attestation, so npm shows which commit and workflow a version came from. Nothing in the API changed.

## 7.0.1

### Patch Changes

- 60eb15a: All `@goodstate/*` packages now share one version number and are released together. Install the same version of every `@goodstate/*` package you use. Nothing in the API changed.

## 2.0.0

### Major Changes

- a91d14d: The package scope is now `@goodstate`. Replace `@nn/` with `@goodstate/` in your dependencies and imports. Nothing else in the API changed.

## 1.0.0

### Major Changes

- 91a6bc5: Adds `@nn/cache`, with two caches for values derived from other state.

  `InvalidatableCache` holds one value that its owner invalidates when the source changes:

  ```ts
  import { InvalidatableCache } from "@nn/cache/invalidatable-cache";

  const cachedItems = new InvalidatableCache<readonly Row[]>();

  cachedItems.ensure(() => Array.from(items.values()));
  cachedItems.invalidate();
  ```

  `VersionedCache` keeps one value per object and loads it again when the object's version changes:

  ```ts
  import { VersionedCache } from "@nn/cache/versioned-cache";

  const cachedProjections = new VersionedCache<Entity, object>();

  cachedProjections.ensure(entity, entity.revision, project);
  ```
