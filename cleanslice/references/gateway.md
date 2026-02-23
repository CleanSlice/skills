# CleanSlice Gateway Pattern

## Overview

The Gateway Pattern separates **what** you need (interface) from **how** you get it (implementation).

```
Controller (or Service)
        │
        │ injects IUserGateway (abstract class)
        ▼
domain/user.gateway.ts   ← Abstract class (contract)
        │
        │ extends (via DI at runtime)
        ▼
data/user.gateway.ts     ← Concrete class (Prisma queries)
```

**Key principle:** The controller/service imports only the abstract class from `domain/`. It never imports the concrete implementation from `data/`. The NestJS DI container wires them together.

---

## Gateway vs Repository

| Use | For | Example |
|-----|-----|---------|
| **Gateway** | Database access via Prisma | `UserGateway` → `PrismaService` |
| **Repository** | External API wrappers | `GitHubRepository` → `@octokit/rest` |

Prisma is already the repository layer. Do not add a Repository on top of Prisma for database access — that is what the Gateway is for.

---

## Why Abstract Class (Not Interface)?

TypeScript interfaces don't exist at runtime — DI containers cannot use them as injection tokens. Abstract classes exist at runtime and work perfectly as tokens.

```typescript
// WRONG — interface disappears at runtime
export interface IUserGateway { ... }
// Requires: { provide: 'IUserGateway', useClass: UserGateway } with string token

// CORRECT — abstract class exists at runtime, IS the token
export abstract class IUserGateway { ... }
// Allows: { provide: IUserGateway, useClass: UserGateway } — clean and type-safe
```

Keep the `I` prefix even though it's an abstract class — it signals "this is a contract, not an implementation".

---

## Full Example: User Slice

### domain/user.gateway.ts (Abstract)

```typescript
import { IUserData, ICreateUserData, IUpdateUserData, IUserFilter } from './user.types';
import { IMetaResponse } from '#core/domain';

export abstract class IUserGateway {
  abstract getUsers(filter?: IUserFilter): Promise<{ data: IUserData[]; meta: IMetaResponse }>;
  abstract getUser(id: string): Promise<IUserData>;
  abstract createUser(data: ICreateUserData): Promise<IUserData>;
  abstract updateUser(id: string, data: IUpdateUserData): Promise<IUserData>;
  abstract deleteUser(id: string): Promise<boolean>;
}
```

### data/user.gateway.ts (Concrete)

```typescript
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IUserGateway } from '../domain/user.gateway';
import { IUserData, ICreateUserData, IUpdateUserData, IUserFilter } from '../domain/user.types';
import { UserMapper } from './user.mapper';
import { PrismaService } from '#prisma';
import { IMetaResponse } from '#core/domain';

@Injectable()
export class UserGateway extends IUserGateway {
  constructor(
    private prisma: PrismaService,
    private map: UserMapper,
  ) {
    super();
  }

  async getUsers(filter?: IUserFilter): Promise<{ data: IUserData[]; meta: IMetaResponse }> {
    const where: Prisma.UserWhereInput = {};
    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    const perPage = filter?.perPage ?? 20;
    const page = filter?.page ?? 1;
    const [results, total] = await Promise.all([
      this.prisma.user.findMany({ where, take: perPage, skip: (page - 1) * perPage }),
      this.prisma.user.count({ where }),
    ]);
    return {
      data: results.map((r) => this.map.toData(r)),
      meta: { total, currentPage: page, perPage, lastPage: Math.ceil(total / perPage) },
    };
  }

  async getUser(id: string): Promise<IUserData> {
    const result = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    return this.map.toData(result);
  }

  async createUser(data: ICreateUserData): Promise<IUserData> {
    const result = await this.prisma.user.create({ data: this.map.toCreate(data) });
    return this.map.toData(result);
  }

  async updateUser(id: string, data: IUpdateUserData): Promise<IUserData> {
    const result = await this.prisma.user.update({
      where: { id },
      data: this.map.toUpdate(data),
    });
    return this.map.toData(result);
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      await this.prisma.user.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
```

### user.module.ts (DI Wiring)

```typescript
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { IUserGateway } from './domain/user.gateway';
import { UserGateway } from './data/user.gateway';
import { UserMapper } from './data/user.mapper';
import { PrismaModule } from '#prisma';

@Module({
  imports: [PrismaModule],
  controllers: [UserController],
  providers: [
    { provide: IUserGateway, useClass: UserGateway },  // Abstract → Concrete
    UserMapper,
  ],
  exports: [
    { provide: IUserGateway, useClass: UserGateway },
  ],
})
export class UserModule {}
```

### Controller Using Gateway (user.controller.ts)

```typescript
import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { IUserGateway } from './domain/user.gateway';

@Controller('users')
export class UserController {
  constructor(private gateway: IUserGateway) {}  // Injects abstract class directly

  @Get()
  getUsers(@Query() query: FilterUserDto) {
    return this.gateway.getUsers(query);
  }
}
```

---

## Conditional Implementations

Swap implementations at runtime without touching domain code:

```typescript
@Module({
  providers: [
    {
      provide: IAuthGateway,
      useClass: process.env.AUTH_PROVIDER === 'cognito'
        ? CognitoAuthGateway
        : BasicAuthGateway,
    },
  ],
})
export class AuthModule {}
```

---

## Optional: Service Layer

Use a service only when you need cross-module coordination or business logic that spans multiple gateways:

```typescript
// domain/user.service.ts
@Injectable()
export class UserService {
  constructor(private readonly gateway: IUserGateway) {}

  async createUser(data: ICreateUserData): Promise<IUserData> {
    // Business logic: normalize before delegating to gateway
    const normalized = { ...data, email: data.email.toLowerCase().trim() };
    return this.gateway.createUser(normalized);
  }
}
```

If the controller can call the gateway directly, skip the service layer.

---

## Frontend Gateway (InversifyJS)

For the Nuxt app, the same pattern applies using InversifyJS instead of NestJS DI:

```typescript
// slices/product/domain/product.gateway.ts
export abstract class IProductGateway {
  abstract getProducts(): Promise<ProductDto[]>;
}

// slices/product/data/product.gateway.ts
@injectable()
export class ProductGateway extends IProductGateway {
  async getProducts(): Promise<ProductDto[]> {
    return ProductService.getProducts();  // Generated API SDK
  }
}

// DI registration (slices/setup/di/container.ts)
container.bind<IProductGateway>(IProductGateway).to(ProductGateway);

// Usage in composable or store
const { $di } = useNuxtApp();
const productGateway = $di.resolve(IProductGateway);
```

---

## Checklist

### Abstract Gateway (domain/)

- [ ] File: `domain/{entity}.gateway.ts`
- [ ] Uses `abstract class` with `I` prefix: `IUserGateway`
- [ ] Methods return domain types from `{entity}.types.ts`
- [ ] Exported in `domain/index.ts`

### Concrete Gateway (data/)

- [ ] File: `data/{entity}.gateway.ts`
- [ ] Class extends the abstract: `extends IUserGateway`
- [ ] `@Injectable()` decorator
- [ ] Uses mapper for all data transformation
- [ ] Imports abstract from `../domain/`
- [ ] No business logic (put in service if needed)

### Module Wiring

- [ ] `{ provide: IAbstract, useClass: Concrete }` in providers
- [ ] Same token in exports if other modules need it
- [ ] Controller injects abstract class (not concrete)

### Never Do

- [ ] NO `interface` as DI token — use `abstract class`
- [ ] NO importing concrete gateway in controller or service
- [ ] NO direct Prisma calls in controllers
- [ ] NO business logic in gateway methods
- [ ] NO calling `data/` layer from `domain/` layer
