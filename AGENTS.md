# AGENTS.md

## Project identity

- This repository is `aqua_viewer_lcdx`, the adaptive LCDX fork of RinNET's AquaViewer frontend.
- The product is an Angular web application, not a generic static site. Preserve the existing Angular and Bootstrap design language.
- Read `docs/PROJECT_MEMORY.md` before making architectural, API, authentication, navigation, or broad UI changes. Update that document when a durable fact in it changes.

## Frontend architecture

- The checked-in application is Angular 22 with TypeScript 6 and the NgModule architecture. Follow nearby modules, components, services, guards, interceptors, and routing patterns; do not introduce standalone-only architecture without an explicit migration task. Components declared by an NgModule must set `standalone: false`.
- Bootstrap 5.2, ng-bootstrap 21, Bootstrap Icons through `@ng-icons`, and `ngx-translate` are the established UI stack.
- Prefer Bootstrap layout, utilities, components, responsive breakpoints, theme variables, and ng-bootstrap behavior over bespoke UI primitives.
- Keep the current responsive shell: `container-xxl`, desktop sidebar, `offcanvas-lg` mobile navigation, and `data-bs-theme` light/dark support.
- Reuse the existing visual vocabulary: compact page headings, cards for records/tools, Bootstrap forms/buttons/alerts/modals, restrained component CSS, and the established spacing scale.
- New user-facing copy should normally use `src/assets/i18n/en.json` and `src/assets/i18n/zh.json` instead of being hard-coded.
- Keep component logic in TypeScript and presentation in templates/styles. Use reactive forms where the surrounding workflow already does so.

## Backend boundary

- `/api/**` belongs to `D:\ALL.NET\RinNET_backend` (Spring Boot). Use the normal `ApiService.get/post/put/delete` methods or the matching existing auth service path.
- `/lcdx/**` belongs to `D:\ALL.NET\LCDXNetApi` (ASP.NET Core). Use the explicit `ApiService.getLcdx/postLcdx` methods or the matching LCDX auth method.
- Routing is explicit, not inferred from the path string. Never send an LCDX endpoint through the normal API methods, or a RinNET endpoint through the LCDX methods.
- In production both environment base URLs are `/`; the reverse proxy is responsible for dispatching `/api` and `/lcdx` to different services. In development they are separate absolute origins.
- The browser stores the RinNET-style account token in `AccountService`. Some LCDX endpoints validate that token against RinNET, so authentication changes must be checked across all three repositories.

## Fork-specific behavior

- Treat LCDX login/QQ registration, one-time sign-in, NetCode binding, LCDX announcements, AccessCode management, KOP ranking, and the custom maimai DX rival-ID transform as intentional fork behavior.
- The primary product navigation is maimai DX focused. Chunithm and Ongeki source modules remain in the tree for inherited/shared code and preloading, but their top-level routes and menus are intentionally not exposed.
- The Angular 22 framework migration has been synchronized from upstream, but upstream auth/admin/navigation behavior is still not the product definition. Continue to port behavior selectively and preserve the LCDX/maimai-focused boundaries above.

## Working and verification rules

- Preserve unrelated user changes in a dirty worktree.
- For API work, inspect the corresponding controller/service in the owning backend before finalizing the frontend contract.
- For UI work, verify responsive behavior at mobile and desktop widths and check both Bootstrap light and dark themes.
- Use the commands already defined in `package.json`; CI currently builds with Node 22 via `npm install` and `npm run build-prod`.
- Do not claim a build/test passed unless dependencies are installed and the command actually ran.
