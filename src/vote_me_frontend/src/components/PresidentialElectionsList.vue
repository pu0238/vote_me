<template>
  <div class="bg-black/50 w-full px-10 py-8 my-4">
    <h3 class="text-2xl bold border-b-2">
      <b>{{ id }}</b> | Wybory prezydenckie
    </h3>
    <div class="text-sm">
      <div class="mt-4 flex justify-between">
        Creator: <small>{{ creator }}</small>
      </div>
      <div class="mt-4 grid">
        Głosy:
        <div v-for="content, index in proposalContent" class="flex justify-between pl-4 py-1 border-b-2">
          <span>{{ index }} | {{ content }}</span>
          <span>
            {{ votesYes[index] }} / {{ usersCount }}
            <b>({{ (BigInt(votesYes[index]) * 100n) / BigInt(usersCount) }}%)</b>
          </span>
        </div>
      </div>
      <div class="mt-4 flex justify-between">
        Stan:
        <span
          :class="{
            'text-green-500': 'Accepted' === state,
            'text-red-500': 'Rejected' === state,
            'text-yellow-500': 'Unresolved' === state,
            'text-blue-500': 'Cancelled' === state,
          }"
        >
          {{ state }}
        </span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import type { VoteState } from "../../../declarations/vote_me_backend/vote_me_backend.did";

export default {
  props: {
    state: {
      type: Object as PropType<VoteState>,
      required: true,
    },

    creator: {
      type: String,
      required: true,
    },
    votesYes: {
      type: BigUint64Array,
      required: true,
    },
    usersCount: {
      type: String,
      required: true,
    },
    id: {
      type: String,
      required: true,
    },
    proposalContent: {
      type: Array<String>,
      required: true,
    },
  },
  setup(props) {
    const state = Object.keys(props.state)[0];

    return {
      state,
    };
  },
};
</script>
