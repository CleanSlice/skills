# CleanSlice Backend (NestJS) Standards

## Slice Structure

```
api/src/slices/{slice}/
├── {slice}.module.ts
├── {slice}.controller.ts
├── domain/
│   ├── index.ts              # Barrel exports
│   ├── {slice}.types.ts      # Interfaces and types
│   ├── {slice}.gateway.ts    # Abstract gateway class (DI token)
│   ├── {slice}.service.ts    # Optional: business logic & orchestration
│   └── errors/               # Domain error classes
│       ├── index.ts
│       └── {entity}NotFound.error.ts
├── data/
│   ├── {slice}.gateway.ts    # Concrete Prisma implementation
│   └── {slice}.mapper.ts     # DB model → domain type transformation
└── dtos/
    ├── index.ts              # Barrel exports
    ├── {slice}.dto.ts        # Response DTO
    ├── create{Slice}.dto.ts  # Create request DTO (camelCase!)
    ├── update{Slice}.dto.ts  # Update request DTO
    └── filter{Slice}.dto.ts  # Query params DTO
```

---

## Layer Responsibilities

| Layer | File | Responsibility | Injects |
|-------|------|----------------|---------|
| Controller | `{slice}.controller.ts` | HTTP endpoints, no logic — delegates to service or gateway | `IEntityGateway` or `EntityService` |
| Service | `domain/{slice}.service.ts` | **Business logic**, validation, orchestration (optional for simple CRUD) | `IEntityGateway` |
| Abstract Gateway | `domain/{slice}.gateway.ts` | Interface contract (abstract class = DI token) | — |
| Concrete Gateway | `data/{slice}.gateway.ts` | Prisma queries, converts raw errors to domain errors | `PrismaService`, `Mapper` |
| Mapper | `data/{slice}.mapper.ts` | DB model ↔ domain type transformation | `ConfigService` (optional) |

**When to use a Service:**
- Complex business logic (validation, normalization, cross-entity rules)
- Orchestrating multiple gateways
- Throwing domain errors based on business rules

**When to skip a Service:**
- Simple CRUD with no business logic — controller can call gateway directly

**Never name services after external integrations:** `AiService`, `StripeService` → these are `AiGateway`, `StripeGateway`

---

## 1. Types (domain/{slice}.types.ts)

```typescript
export interface IUserData {
  id: string;
  name: string;
  email: string;
  roles: RoleTypes[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICreateUserData {
  name: string;
  email: string;
  roles?: RoleTypes[];
}

export interface IUpdateUserData {
  name?: string;
  roles?: RoleTypes[];
  verified?: boolean;
}

export interface IUserFilter {
  email?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

export enum RoleTypes {
  User = 'user',
  Admin = 'admin',
}
```

**Naming conventions:**
- Interface data types: `I{Entity}Data`
- Create/update inputs: `ICreate{Entity}Data`, `IUpdate{Entity}Data`
- Filter types: `I{Entity}Filter`
- Enums: `{Name}Types` suffix

---

## 2. Abstract Gateway (domain/{slice}.gateway.ts)

```typescript
// Use abstract CLASS — not interface — so it exists at runtime as a DI token
export abstract class IUserGateway {
  abstract getUsers(filter?: IUserFilter): Promise<{ data: IUserData[]; meta: IMetaResponse }>;
  abstract getUser(id: string): Promise<IUserData>;
  abstract createUser(data: ICreateUserData): Promise<IUserData>;
  abstract updateUser(id: string, data: IUpdateUserData): Promise<IUserData>;
  abstract deleteUser(id: string): Promise<boolean>;
}
```

---

## 3. Concrete Gateway (data/{slice}.gateway.ts)

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

    if (filter?.email) where.email = { contains: filter.email, mode: 'insensitive' };
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
    const result = await this.prisma.user.update({ where: { id }, data: this.map.toUpdate(data) });
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

---

## 4. Mapper (data/{slice}.mapper.ts)

```typescript
import { Injectable } from '@nestjs/common';
import { User as PrismaUser, Prisma } from '@prisma/client';
import { IUserData, ICreateUserData, IUpdateUserData, RoleTypes } from '../domain/user.types';
import { v4 as uuid } from 'uuid';

@Injectable()
export class UserMapper {
  toData(user: PrismaUser): IUserData {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles as RoleTypes[],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  toCreate(data: ICreateUserData): Prisma.UserCreateInput {
    return {
      id: `user-${uuid()}`,
      name: data.name,
      email: data.email.toLowerCase().trim(),
      roles: data.roles ?? [RoleTypes.User],
    };
  }

  toUpdate(data: IUpdateUserData): Prisma.UserUpdateInput {
    return {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.roles !== undefined && { roles: data.roles }),
      ...(data.verified !== undefined && { verified: data.verified }),
    };
  }
}
```

**Mapper methods:**
- `toData()` — Prisma model → domain interface
- `toCreate()` — Create input → Prisma create arg
- `toUpdate()` — Update input → Prisma update arg

---

## 5. Service (domain/{slice}.service.ts) — Optional

Use a service when there is business logic beyond simple data access:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { IUserGateway } from './user.gateway';
import { IUserData, ICreateUserData, IUpdateUserData } from './user.types';
import { UserNotFoundError } from './errors/userNotFound.error';
import { UserExistsError } from './errors/userExists.error';

@Injectable()
export class UserService {
  constructor(
    @Inject(IUserGateway)
    private readonly userGateway: IUserGateway,
  ) {}

  async createUser(data: ICreateUserData): Promise<IUserData> {
    // Business logic: normalize, validate, check uniqueness
    const normalized = { ...data, email: data.email.toLowerCase().trim() };
    const existing = await this.userGateway.findByEmail(normalized.email);
    if (existing) throw new UserExistsError(normalized.email);
    return this.userGateway.createUser(normalized);
  }

  async getUser(id: string): Promise<IUserData> {
    const user = await this.userGateway.getUser(id);
    if (!user) throw new UserNotFoundError(id);
    return user;
  }

  async updateUser(id: string, data: IUpdateUserData): Promise<IUserData> {
    await this.getUser(id);  // throws UserNotFoundError if missing
    return this.userGateway.updateUser(id, data);
  }

  async deleteUser(id: string): Promise<void> {
    await this.getUser(id);
    await this.userGateway.deleteUser(id);
  }
}
```

**Service rules:**
- `@Inject(IUserGateway)` — inject abstract class, never concrete
- Returns domain types (`IUserData`), not DTOs
- No `{ success: true }` wrapper — return data directly
- Business logic here: normalization, uniqueness checks, cross-entity rules
- Private helpers go after public methods
- Module must register service and add it to exports

---

## 6. DTOs

**Response DTO (`dtos/{slice}.dto.ts`):**

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IUserData, RoleTypes } from '../domain/user.types';

export class UserDto implements IUserData {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: RoleTypes, isArray: true })
  roles: RoleTypes[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
```

**Create DTO (`dtos/create{Slice}.dto.ts` — camelCase!):**

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, IsArray, IsOptional } from 'class-validator';
import { ICreateUserData, RoleTypes } from '../domain/user.types';

export class CreateUserDto implements ICreateUserData {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ enum: RoleTypes, isArray: true })
  @IsArray()
  @IsOptional()
  roles?: RoleTypes[];
}
```

**Filter DTO (`dtos/filter{Slice}.dto.ts`):**

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';
import { IUserFilter } from '../domain/user.types';

export class FilterUserDto implements IUserFilter {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @IsOptional()
  perPage?: number = 20;
}
```

---

## 7. Controller ({slice}.controller.ts)

```typescript
import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IUserGateway } from './domain/user.gateway';
import { CreateUserDto, UpdateUserDto, FilterUserDto } from './dtos';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private gateway: IUserGateway) {}  // Injects abstract class

  @ApiOperation({ summary: 'Get users', operationId: 'getUsers' })
  @Get()
  getUsers(@Query() query: FilterUserDto) {
    return this.gateway.getUsers(query);
  }

  @ApiOperation({ summary: 'Get user', operationId: 'getUser' })
  @Get(':id')
  getUser(@Param('id') id: string) {
    return this.gateway.getUser(id);
  }

  @ApiOperation({ summary: 'Create user', operationId: 'createUser' })
  @Post()
  createUser(@Body() data: CreateUserDto) {
    return this.gateway.createUser(data);
  }

  @ApiOperation({ summary: 'Update user', operationId: 'updateUser' })
  @Put(':id')
  updateUser(@Param('id') id: string, @Body() data: UpdateUserDto) {
    return this.gateway.updateUser(id, data);
  }

  @ApiOperation({ summary: 'Delete user', operationId: 'deleteUser' })
  @Delete(':id')
  deleteUser(@Param('id') id: string) {
    return this.gateway.deleteUser(id);
  }
}
```

**Controller rules:**
- Inject the abstract gateway class — never the concrete implementation
- Every endpoint needs `@ApiOperation({ operationId })` for SDK generation
- No business logic in controllers — delegate everything to gateway

---

## 8. Module ({slice}.module.ts)

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
    UserService,   // Add when using a service layer
  ],
  exports: [
    { provide: IUserGateway, useClass: UserGateway },
    UserService,   // Export if other modules need it
  ],
})
export class UserModule {}
```

---

## 9. Barrel Exports

```typescript
// domain/index.ts
export * from './user.types';
export * from './user.gateway';

// dtos/index.ts
export * from './user.dto';
export * from './createUser.dto';
export * from './updateUser.dto';
export * from './filterUser.dto';
```

---

## 10. Cross-Slice Imports

```typescript
// Use # alias configured in tsconfig.json
import { IUserGateway } from '#user/domain';
import { UserDto } from '#user/dtos';
import { PrismaModule } from '#prisma';
```

```json
// api/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "#": ["src/slices"],
      "#*": ["src/slices/*"]
    }
  }
}
```

---

## Checklist

### Before creating a slice

- [ ] Slice name is SINGULAR (`user/` not `users/`)
- [ ] Prisma schema is updated first
- [ ] Types defined before gateway

### Module

- [ ] Uses `{ provide: IAbstract, useClass: Concrete }` for gateway
- [ ] Imports `PrismaModule`
- [ ] Exports what other modules need

### Controller

- [ ] Injects abstract class `IEntityGateway`
- [ ] `@ApiTags()` on class
- [ ] `@ApiOperation({ operationId })` on every endpoint
- [ ] No business logic (delegates to gateway)

### Gateway

- [ ] Abstract class (NOT interface) in `domain/`
- [ ] Concrete class extends abstract in `data/`
- [ ] Uses mapper for all data transformation
- [ ] Returns typed domain interfaces

### DTOs

- [ ] DTO files are camelCase: `createUser.dto.ts`
- [ ] Response DTOs implement `I{Entity}Data`
- [ ] `@ApiProperty()` on every field
- [ ] Validators on create/update DTOs
- [ ] `@Transform()` for numeric query params

### Never Do

- [ ] NO business logic in controllers
- [ ] NO direct Prisma calls in controllers
- [ ] NO TypeScript `interface` as DI token (use abstract class)
- [ ] NO manual data transformation in gateway (use mapper)
- [ ] NO importing concrete gateway in controller
