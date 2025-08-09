# Project Overview

This project is built using React and Node.js. The project uses pnpm as its package manager.

## Folder Structure

- `apps/`: Contains example applications (`example-react`, `example-server`).
- `packages/`: Contains reusable packages (`entities`, `event-emitter`, `http-remote`, etc.).
- `docs/`: Contains documentation.

## Code Quality Tools

- The project uses Biome for auto-formatting and enforcing coding rules.
- Write unit tests using `vitest`.

## Available Scripts

- `pnpm dev`: To run the development servers.
- `pnpm ts:check`: To run the TypeScript compiler.
- `pnpm lint`: To run the linter.
- `pnpm format`: To run the formatter.
- `pnpm test`: To run the tests.
- `pnpm test:watch`: To run the tests in watch mode.
- `pnpm test:coverage`: To run the tests with coverage.

## Libraries and Frameworks

- React and Tailwind CSS for the frontend.
- Node.js and Express for the backend.

## Coding Standards

- Prefer destructuring for props and objects.
- Use modern TypeScript syntax and features.
- Use semicolons at the end of each statement.
- Use double quotes for strings.
- Use function based components in React.
- Use arrow functions for callbacks.
- Avoid deprecated or legacy APIs.
- Use `async/await` for asynchronous operations.

## UI guidelines

- Application should have a modern and clean design.

### Avoid

- Avoid using `any` types. Always use specific types or interfaces.
- Avoid nesting ternary expressions.
