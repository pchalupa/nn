/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as BacklogImport } from './routes/backlog'
import { Route as IndexImport } from './routes/index'

// Create/Update Routes

const BacklogRoute = BacklogImport.update({
  id: '/backlog',
  path: '/backlog',
  getParentRoute: () => rootRoute,
} as any)

const IndexRoute = IndexImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexImport
      parentRoute: typeof rootRoute
    }
    '/backlog': {
      id: '/backlog'
      path: '/backlog'
      fullPath: '/backlog'
      preLoaderRoute: typeof BacklogImport
      parentRoute: typeof rootRoute
    }
  }
}

// Create and export the route tree

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/backlog': typeof BacklogRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/backlog': typeof BacklogRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/': typeof IndexRoute
  '/backlog': typeof BacklogRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/backlog'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/backlog'
  id: '__root__' | '/' | '/backlog'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  BacklogRoute: typeof BacklogRoute
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  BacklogRoute: BacklogRoute,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/backlog"
      ]
    },
    "/": {
      "filePath": "index.tsx"
    },
    "/backlog": {
      "filePath": "backlog.tsx"
    }
  }
}
ROUTE_MANIFEST_END */
