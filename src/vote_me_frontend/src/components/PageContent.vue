<template>
  <div>
    <Suspense>
      <VoteList />
    </Suspense>
  </div>
</template>

<script lang="ts" setup>
import VoteList from "./VoteList.vue";
</script>
