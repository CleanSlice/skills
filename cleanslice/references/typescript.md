# CleanSlice TypeScript Standards

> Applies to all TypeScript code in both `api/` (NestJS) and `app/` (Nuxt).

---

## Critical Rules Summary

| Rule | Correct | Incorrect |
|------|---------|-----------|
| No `any` | `unknown` + type guard | `any` |
| Interface prefix | `IUserData` | `UserData` |
| Enum suffix | `UserStatusTypes` | `UserStatus` |
| Explicit return types | `function(): string {}` | `function() {}` |
| Optional property | `name?: string` | `name: string \| undefined` |
| Inject dependencies | `private readonly` | `private` |
| Cross-slice imports | `#prisma`, `#user/domain` | `../../prisma/...` |
| Exports | Named exports | Default exports |
| Async | `async/await` | `.then()` chains |

---

## 1. Never Use `any`

```typescript
// WRONG
function process(data: any) { return data.name; }

// CORRECT — unknown + type guard
function process(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'name' in data) {
    return (data as { name: string }).name;
  }
  throw new Error('Invalid data');
}

// CORRECT — proper interface
function process(data: IUserData): string { return data.name; }
```

When you think you need `any`:

| Situation | Use Instead |
|-----------|-------------|
| Unknown API response | `unknown` + type guard |
| Dynamic object keys | `Record<string, T>` |
| Multiple types | Union `A \| B \| C` |
| Third-party lib | Create type definition |

---

## 2. Interface Naming: `I` Prefix

ALL interfaces must start with `I`:

```typescript
// CORRECT
export interface IUserData { id: string; name: string; }
export interface ICreateUserData { name: string; email: string; }
export interface IUserGateway { getUser(id: string): Promise<IUserData>; }

// WRONG
export interface UserData { ... }
export interface CreateUserInput { ... }
```

| Pattern | Example |
|---------|---------|
| `I{Entity}Data` | `IUserData`, `IProjectData` |
| `ICreate{Entity}Data` | `ICreateUserData` |
| `IUpdate{Entity}Data` | `IUpdateUserData` |
| `I{Entity}Filter` | `IUserFilter` |
| `I{Action}Request` | `ILoginRequest` |
| `I{Action}Response` | `ILoginResponse` |
| `I{Entity}Gateway` | `IUserGateway` |
| `I{Entity}With{Extra}` | `IUserWithTeams` |

---

## 3. Enum Naming: `Types` Suffix

ALL enums must end with `Types` and use **string values**:

```typescript
// CORRECT
export enum UserStatusTypes {
  Active = 'active',
  Inactive = 'inactive',
  Pending = 'pending',
}
export enum RoleTypes {
  Admin = 'admin',
  User = 'user',
}

// WRONG — no Types suffix
export enum UserStatus { Active = 'active' }

// WRONG — numeric values
export enum UserStatusTypes { Active, Inactive }

// WRONG — SCREAMING_CASE values
export enum UserStatusTypes { ACTIVE = 'ACTIVE' }
```

---

## 4. Explicit Return Types

Always declare return types on functions and methods:

```typescript
// CORRECT
function getUser(id: string): IUserData { ... }
async function fetchUser(id: string): Promise<IUserData> { ... }
async function findUser(id: string): Promise<IUserData | null> { ... }
function deleteUser(): void { ... }

// WRONG — inferred
function getUser(id: string) { return { id, name: 'John' }; }
```

---

## 5. Interface vs Type Alias

```typescript
// INTERFACE — for object shapes
export interface IUserData { id: string; name: string; }

// TYPE — for unions, utilities, function signatures
export type UserRole = 'admin' | 'user' | 'guest';
export type Nullable<T> = T | null;
export type UserValidator = (user: IUserData) => boolean;

// WRONG — type alias for object shape
export type UserData = { id: string; name: string };
```

---

## 6. Optional Properties

Use `?` not `| undefined`:

```typescript
// CORRECT
export interface IUpdateUserData {
  name?: string;
  email?: string;
}

// WRONG
export interface IUpdateUserData {
  name: string | undefined;
}
```

Use `null` for intentional absence (API field that can be cleared):
```typescript
export interface IUserData {
  avatarUrl: string | null;  // intentionally empty
  bio?: string;              // not provided
}
```

---

## 7. Class Properties

```typescript
@Injectable()
export class UserService {
  constructor(
    private readonly userGateway: IUserGateway,  // readonly + private
    private readonly logger: LoggerService,
  ) {}
}

// WRONG
constructor(private userGateway: IUserGateway) {}  // Missing readonly
```

---

## 8. Async/Await

Always use async/await, never raw Promise chains:

```typescript
// CORRECT
async function getUser(id: string): Promise<IUserData> {
  const user = await this.gateway.findById(id);
  if (!user) throw new UserNotFoundError(id);
  return user;
}

// CORRECT — parallel operations
const [user, team] = await Promise.all([
  this.userGateway.findById(userId),
  this.teamGateway.findByUserId(userId),
]);

// WRONG — raw promise chain
function getUser(id: string) {
  return this.gateway.findById(id).then(user => user ?? null);
}
```

---

## 9. Named Exports (No Default Exports)

```typescript
// CORRECT
export interface IUserData { ... }
export class UserService { ... }
export enum RoleTypes { ... }

// WRONG
export default class UserService { ... }

// EXCEPTION — framework requires it
export default defineNuxtConfig({ ... });
```

---

## 10. Import Organization

Order imports in this sequence:

```typescript
// 1. Node.js built-ins / Framework
import { Injectable } from '@nestjs/common';
import { readFile } from 'fs/promises';

// 2. External packages
import { v4 as uuid } from 'uuid';

// 3. Slice aliases (#SLICE_NAME) — cross-slice
import { PrismaService } from '#prisma';
import { IUserData } from '#user/domain';

// 4. Relative imports — same slice only
import { UserMapper } from './user.mapper';
import { IUserGateway } from '../domain/user.gateway';
```

---

## 11. Slice Import Aliases

**Always use `#` aliases for cross-slice imports. Never use `../../../` across slice boundaries.**

```typescript
// CORRECT
import { PrismaService } from '#prisma';
import { IUserData } from '#user/domain';
import { cn } from '#theme/utils/cn';

// WRONG — relative path crossing slice boundary
import { PrismaService } from '../../prisma/prisma.service';
import { IUserData } from '../../../user/domain/user.types';

// CORRECT — relative path within same slice is fine
import { UserMapper } from './user.mapper';
import { IUserData } from '../domain/user.types';
```

**Configure aliases:**

```json
// api/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "#prisma": ["./src/slices/setup/prisma"],
      "#core": ["./src/slices/setup/core"],
      "#user/*": ["./src/slices/user/*"]
    }
  }
}
```

```typescript
// app/slices/setup/theme/nuxt.config.ts
export default defineNuxtConfig({
  alias: { '#theme': currentDir },
});
```

Common aliases:

| Alias | Points To |
|-------|-----------|
| `#prisma` | `slices/setup/prisma` |
| `#core` | `slices/setup/core` |
| `#api` | `slices/setup/api` (generated SDK) |
| `#theme` | `slices/setup/theme` |
| `#error` | `slices/setup/error` |

---

## 12. Utility Types

```typescript
// Partial — all fields optional
type PartialUser = Partial<IUserData>;

// Pick — subset of fields
type UserSummary = Pick<IUserData, 'id' | 'name'>;

// Omit — exclude fields
type UserWithoutTimestamps = Omit<IUserData, 'createdAt' | 'updatedAt'>;

// Readonly — immutable
const ROLES: readonly string[] = ['admin', 'user'] as const;

// Record — typed map
const config: Record<string, string> = { apiUrl: 'https://api.example.com' };

// Const assertion — literal types
export const ErrorCodes = {
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
} as const;
type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
```

---

## Checklist

- [ ] No `any` types — use `unknown` with type guards
- [ ] All interfaces have `I` prefix: `IUserData`
- [ ] All enums have `Types` suffix: `RoleTypes`
- [ ] All functions have explicit return types
- [ ] Use `?` for optional, not `| undefined`
- [ ] Use `private readonly` for constructor injections
- [ ] Named exports only (except framework requirements)
- [ ] async/await everywhere (no `.then()`)
- [ ] `#SLICE_NAME` aliases for cross-slice imports
- [ ] No `../../../` crossing slice boundaries
