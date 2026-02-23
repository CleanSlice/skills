# CleanSlice Frontend (Nuxt) Standards

## Slice Structure

```
app/slices/{slice}/
├── nuxt.config.ts            # Slice-level Nuxt config (alias, modules)
├── pages/
│   ├── {slices}.vue          # List page — route is PLURAL
│   └── {slices}/
│       └── [id].vue          # Detail page
├── components/
│   └── {slice}/
│       ├── Provider.vue      # REQUIRED in every component folder
│       ├── Item.vue          # Display single entity (props only)
│       ├── Form.vue          # Create/edit form
│       └── Thumb.vue         # List item card
├── stores/
│   └── {slice}.ts            # Pinia store
└── composables/              # Non-state utilities only (NOT for state)
    └── use{Slice}.ts
```

---

## Auto-Import Rules

**Nuxt auto-imports these — do NOT manually import them:**

```typescript
// Vue APIs — auto-imported
const count = ref(0);
const doubled = computed(() => count.value * 2);
watch(count, (val) => console.log(val));
onMounted(() => {});

// WRONG: import { ref, computed, watch, onMounted } from 'vue';
```

```typescript
// Nuxt composables — auto-imported
const route = useRoute();
const router = useRouter();
const { data } = await useFetch('/api/users');
definePageMeta({ layout: 'dashboard' });

// WRONG: import { useRoute } from '#app';
```

```vue
<!-- Components — auto-imported -->
<template>
  <Button variant="primary">Click</Button>
  <UserProvider />
</template>
<!-- WRONG: import { Button } from '#theme/components/ui/button'; -->
```

```typescript
// Pinia stores — auto-imported
const authStore = useAuthStore();
// WRONG: import { useAuthStore } from '~/slices/user/auth/stores/auth';
```

**Must be imported manually:**

```typescript
// API SDK (generated types and services)
import { UserService, UserDto, CreateUserDto } from '#api';

// External libraries
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';

// Types across slices
import type { UserDto } from '#api';
import { cn } from '#theme/utils/cn';
```

---

## 1. Slice nuxt.config.ts

```typescript
// slices/user/nuxt.config.ts
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineNuxtConfig({
  alias: { '#user': currentDir },
  imports: {
    dirs: ['./composables'],
  },
});
```

**Root nuxt.config.ts registers all slices:**

```typescript
// app/nuxt.config.ts
export default defineNuxtConfig({
  extends: [
    './slices/setup/theme',
    './slices/setup/pinia',
    './slices/setup/api',
    './slices/setup/error',
    './slices/user',
    './slices/project',
  ],
});
```

---

## 2. Page Standards

**Pages use Provider components — no data fetching in pages:**

```vue
<!-- slices/user/pages/users.vue -->
<script lang="ts" setup>
definePageMeta({
  layout: 'dashboard',
  auth: { public: false },
});
</script>

<template>
  <UserListProvider />
</template>
```

```vue
<!-- slices/user/pages/users/[id].vue -->
<script lang="ts" setup>
definePageMeta({ layout: 'dashboard' });
const route = useRoute();
</script>

<template>
  <UserItemProvider :id="route.params.id as string" />
</template>
```

---

## 3. Provider.vue Pattern

**Provider is the data-fetching bootstrap component. Every component folder MUST have one.**

```vue
<!-- slices/user/components/user/Provider.vue -->
<script lang="ts" setup>
import { UsersService, UserDto } from '#api';

const { data, pending, error, refresh } = useAsyncData(
  'users',
  () => UsersService.getUsers(),
);
</script>

<template>
  <div v-if="pending">Loading...</div>
  <div v-else-if="error">Error: {{ error.message }}</div>
  <template v-else>
    <UserItem
      v-for="user in data?.data"
      :key="user.id"
      :user="user"
      @update="refresh"
    />
  </template>
</template>
```

**Provider with ID prop (for detail pages):**

```vue
<!-- slices/user/components/userItem/Provider.vue -->
<script lang="ts" setup>
import { UsersService } from '#api';

const props = defineProps<{ id: string }>();

const { data, pending, error, refresh } = useAsyncData(
  `user-${props.id}`,
  () => UsersService.getUser({ id: props.id }),
);
</script>

<template>
  <div v-if="pending">Loading...</div>
  <UserItemDetails v-else :user="data?.data" @update="refresh" />
</template>
```

---

## 4. Item.vue Pattern

**Pure display component — receives data via props, no fetching:**

```vue
<!-- slices/user/components/user/Item.vue -->
<script lang="ts" setup>
import type { UserDto } from '#api';

defineProps<{
  user: UserDto;
  pending?: boolean;
}>();
</script>

<template>
  <div class="py-2">
    <Skeleton v-if="pending" class="h-4 w-[200px]" />
    <template v-else>
      <div class="font-medium">{{ user.name }}</div>
      <div class="text-sm text-muted-foreground">{{ user.email }}</div>
    </template>
  </div>
</template>
```

---

## 5. Form.vue Pattern

**Handles create/edit with vee-validate + zod. Emits `update` on success:**

```vue
<!-- slices/user/components/user/Form.vue -->
<script lang="ts" setup>
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { UsersService, UserDto, UpdateUserDto } from '#api';

const props = defineProps<{ user: UserDto }>();
const emit = defineEmits<{ update: [value: UserDto] }>();

const loading = ref(false);
const isOpen = ref(false);

const schema = toTypedSchema(z.object({
  name: z.string().min(1, 'Name is required').default(props.user.name),
  email: z.string().email().default(props.user.email),
}));

const form = useForm({ validationSchema: schema });

const submit = form.handleSubmit(async (values) => {
  loading.value = true;
  try {
    const result = await UsersService.updateUser({
      id: props.user.id,
      requestBody: values as UpdateUserDto,
    });
    isOpen.value = false;
    emit('update', result.data);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <Button variant="outline">Edit</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit User</DialogTitle>
      </DialogHeader>
      <form class="space-y-4" @submit="submit">
        <FormField v-slot="{ componentField }" name="name">
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl><Input v-bind="componentField" /></FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <Button type="submit" :disabled="loading">Save</Button>
      </form>
    </DialogContent>
  </Dialog>
</template>
```

---

## 6. Pinia Store

```typescript
// slices/user/stores/user.ts
import { defineStore } from 'pinia';
import { UsersService, UserDto, CreateUserDto } from '#api';

export const useUserStore = defineStore('user', {
  state: () => ({
    users: [] as UserDto[],
    loading: false,
    error: null as string | null,
  }),

  getters: {
    getUserById: (state) => (id: string) =>
      state.users.find((u) => u.id === id),
  },

  actions: {
    async fetchUsers() {
      this.loading = true;
      this.error = null;
      try {
        const response = await UsersService.getUsers();
        this.users = response.data;
      } catch (e) {
        this.error = 'Failed to load users';
      } finally {
        this.loading = false;
      }
    },

    async createUser(data: CreateUserDto) {
      const response = await UsersService.createUser({ requestBody: data });
      this.users.push(response.data);
      return response.data;
    },
  },
});
```

**Store naming:**
- Function: `use{Entity}Store`
- File: `{entity}.ts`
- Location: `slices/{slice}/stores/`
- Store ID: matches entity name (`'user'`, `'auth'`)

**Usage (auto-imported, no import needed):**

```vue
<script setup lang="ts">
const userStore = useUserStore();
await userStore.fetchUsers();
const user = computed(() => userStore.getUserById(route.params.id));
</script>
```

---

## 7. Composable Standards

```typescript
// slices/user/composables/useUserActions.ts
export const useUserActions = () => {
  const store = useUserStore();
  const router = useRouter();

  const deleteUser = async (id: string) => {
    await UsersService.deleteUser({ id });
    await store.fetchUsers();
    router.push('/users');
  };

  return { deleteUser };
};
```

**Use composables for:** Non-state utilities, event handlers, computed helpers
**Use stores for:** Any state that needs to persist or be shared

---

## 8. Component Naming Convention

Auto-import name = `{FolderName}{FileName}` (PascalCase):

| Folder/File | Auto-Import Name | Usage |
|-------------|------------------|-------|
| `user/Provider.vue` | `UserProvider` | `<UserProvider />` |
| `userList/Provider.vue` | `UserListProvider` | `<UserListProvider />` |
| `userItem/Provider.vue` | `UserItemProvider` | `<UserItemProvider :id="id" />` |
| `userCreate/Provider.vue` | `UserCreateProvider` | `<UserCreateProvider />` |
| `user/Form.vue` | `UserForm` | `<UserForm :user="user" />` |
| `user/Item.vue` | `UserItem` | `<UserItem :user="user" />` |
| `userList/Thumb.vue` | `UserListThumb` | `<UserListThumb :user="user" />` |

**Rules:**
- Every component folder MUST have `Provider.vue`
- Maximum ONE level of folders inside `components/`
- Use combined names: `userList/` NOT `user/list/`

---

## Checklist

### Auto-Imports

- [ ] NO imports for Vue APIs (ref, computed, watch, etc.)
- [ ] NO imports for Nuxt composables (useRoute, useFetch, etc.)
- [ ] NO imports for components from slices
- [ ] NO imports for Pinia stores
- [ ] Import API SDK types/services from `#api`

### Slice Config

- [ ] Each slice has `nuxt.config.ts`
- [ ] Alias configured: `'#sliceName': currentDir`
- [ ] Registered in root `nuxt.config.ts` extends array

### Components

- [ ] `<script setup lang="ts">` on every component
- [ ] Every component folder has `Provider.vue`
- [ ] Max ONE level of folders inside `components/`
- [ ] `Provider.vue` uses `useAsyncData` for SSR-safe fetching
- [ ] `Item.vue` receives data via props only (no fetching)
- [ ] `Form.vue` emits `update` event on success

### Stores

- [ ] Located in `slices/{slice}/stores/`
- [ ] Named `use{Entity}Store`
- [ ] Typed state and getters
- [ ] Actions use async/await with loading/error state

### Never Do

- [ ] NO importing Vue APIs
- [ ] NO importing Nuxt composables
- [ ] NO importing components (they're auto-imported)
- [ ] NO importing stores (they're auto-imported)
- [ ] NO Options API — use Composition API only
- [ ] NO composables for shared state — use Pinia stores
- [ ] NO data fetching inside Item.vue — only Provider.vue fetches
