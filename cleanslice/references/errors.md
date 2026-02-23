# CleanSlice Error Pattern

> Errors are defined in the **domain layer** and extend `BaseError`. Controllers never need try/catch — the global interceptor handles all errors automatically.

---

## Error Flow

```
CONTROLLER          — no try/catch needed, interceptor handles everything
     │
     ▼
SERVICE             — throws domain errors for business rule violations
     │
     ▼
GATEWAY             — catches raw repository errors, converts to domain errors
     │
     ▼
REPOSITORY          — throws raw errors (Prisma exceptions, API errors, etc.)
     │
     ▼ all caught by
ERROR INTERCEPTOR   — formats standardized JSON response, logs error
```

---

## File Locations

**Setup slice** (infrastructure, created once):
```
slices/setup/error/
├── domain/
│   ├── base.error.ts              # BaseError class — extend this
│   ├── error.types.ts             # ErrorCodes enum, IErrorResponse
│   └── domain.errors.ts           # Generic errors (ValidationError, etc.)
├── interceptors/
│   └── error-handling.interceptor.ts
└── error.module.ts
```

**Feature slice** (per feature):
```
slices/user/
└── domain/
    └── errors/
        ├── index.ts               # Re-export all errors
        ├── error.types.ts         # Slice-specific error codes
        ├── userNotFound.error.ts
        ├── userExists.error.ts
        └── userNotAuthorized.error.ts
```

**Naming convention:**

| Item | Format | Example |
|------|--------|---------|
| File | `{errorName}.error.ts` (camelCase) | `userNotFound.error.ts` |
| Class | `{ErrorName}Error` | `UserNotFoundError` |
| Error code | `SCREAMING_SNAKE_CASE` | `USER_NOT_FOUND` |

---

## BaseError (setup/error/domain/base.error.ts)

```typescript
import { HttpException } from '@nestjs/common';
import { ErrorCodes } from './error.types';

export abstract class BaseError extends HttpException {
  public code: ErrorCodes = ErrorCodes.UNEXPECTED_ERROR;

  constructor(
    message: string,
    statusCode: number = 500,
    options?: { cause?: Error }
  ) {
    super(message, statusCode, { cause: options?.cause });
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
```

---

## ErrorCodes Enum (setup/error/domain/error.types.ts)

```typescript
export enum ErrorCodes {
  UNEXPECTED_ERROR = 'UNEXPECTED_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  BAD_REQUEST = 'BAD_REQUEST',
  // Add domain-specific codes in each slice's error.types.ts
}
```

---

## Creating Domain Errors

```typescript
// slices/user/domain/errors/userNotFound.error.ts
import { BaseError } from '#setup/error';
import { HttpStatus } from '@nestjs/common';
import { UserErrorCodes } from './error.types';

export class UserNotFoundError extends BaseError {
  public readonly code = UserErrorCodes.USER_NOT_FOUND;

  constructor(userId: string, options?: { cause: Error }) {
    super(`User with ID '${userId}' was not found.`, HttpStatus.NOT_FOUND, options);
  }
}

// slices/user/domain/errors/userExists.error.ts
export class UserExistsError extends BaseError {
  public readonly code = UserErrorCodes.USER_EXISTS;

  constructor(email: string) {
    super(`User with email '${email}' already exists.`, HttpStatus.CONFLICT);
  }
}

// slices/user/domain/errors/userNotAuthorized.error.ts
export class UserNotAuthorizedError extends BaseError {
  public readonly code = UserErrorCodes.USER_NOT_AUTHORIZED;

  constructor(message?: string) {
    super(message ?? 'Username or password was incorrect.', HttpStatus.BAD_REQUEST);
  }
}
```

---

## Throwing Errors

**In Services (business rule violations):**

```typescript
// domain/user.service.ts
async getUser(id: string): Promise<IUserData> {
  const user = await this.userGateway.getUser(id);
  if (!user) {
    throw new UserNotFoundError(id);
  }
  return user;
}

async createUser(data: ICreateUserData): Promise<IUserData> {
  const existing = await this.userGateway.findByEmail(data.email);
  if (existing) {
    throw new UserExistsError(data.email);
  }
  return this.userGateway.createUser(data);
}
```

**In Gateways (converting repository errors to domain errors):**

```typescript
// data/user.gateway.ts
async deleteUser(id: string): Promise<boolean> {
  try {
    await this.prisma.user.delete({ where: { id } });
    return true;
  } catch (error) {
    if (error.code === 'P2025') {  // Prisma "record not found"
      throw new UserNotFoundError(id, { cause: error });
    }
    throw new DatabaseError('Failed to delete user', { cause: error });
  }
}
```

**In Controllers — NO try/catch needed:**

```typescript
// user.controller.ts
@Get(':id')
async getUser(@Param('id') id: string): Promise<UserDto> {
  return this.userService.getUser(id);  // errors bubble to interceptor automatically
}
```

---

## Error Handling Interceptor

Registered globally in `setup/error/error.module.ts`:

```typescript
@Module({
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ErrorHandlingInterceptor },
  ],
})
export class ErrorModule {}
```

All errors return this standardized response:

```json
{
  "code": "USER_NOT_FOUND",
  "statusCode": 404,
  "message": "User with ID 'user-123' was not found.",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/users/user-123"
}
```

---

## HTTP Status Reference

| Status | When | Examples |
|--------|------|---------|
| 400 | Bad Request / Business rule violation | `UserNotAuthorizedError`, `ValidationError` |
| 401 | Not authenticated | `UnauthorizedError` |
| 403 | Authenticated but forbidden | `UserBannedError` |
| 404 | Not found | `UserNotFoundError` |
| 409 | Conflict / Already exists | `UserExistsError` |
| 500 | Unexpected / Server error | `DatabaseError`, `UnexpectedError` |

---

## Barrel Export

```typescript
// domain/errors/index.ts
export * from './error.types';
export * from './userNotFound.error';
export * from './userExists.error';
export * from './userNotAuthorized.error';

// domain/index.ts
export * from './user.types';
export * from './user.gateway';
export * from './errors';  // includes all errors
```

---

## Checklist

### Setup

- [ ] `setup/error` slice exists with `BaseError` and `ErrorCodes`
- [ ] `ErrorHandlingInterceptor` registered globally via `APP_INTERCEPTOR`
- [ ] `ErrorModule` imported in `AppModule`

### Per Slice

- [ ] Errors in `domain/errors/` folder
- [ ] File named `{errorName}.error.ts` (camelCase)
- [ ] Class extends `BaseError`
- [ ] Uses appropriate `HttpStatus` code
- [ ] All errors exported via `domain/errors/index.ts`

### Usage

- [ ] Services throw domain errors for business rules
- [ ] Gateways catch Prisma/external errors and re-throw as domain errors
- [ ] Controllers have NO try/catch
- [ ] Error cause passed when converting errors

### Never Do

- [ ] NO try/catch in controllers
- [ ] NO raw `throw new Error()` in services/gateways
- [ ] NO Prisma/repository errors leaking to controller
- [ ] NO hardcoded error strings — always use error classes
