<template>
  <div class="bg-black/50 w-full px-10 py-8 my-4">
    <h3 class="text-2xl bold border-b-2">
      <b>{{ id }}</b> | {{ title }}
    </h3>
    <div class="text-sm">
      <div class="mt-4 flex justify-between">
        Creator: <small>{{ creator }}</small>
      </div>
      <div class="mt-4 flex justify-between">
        Głosy:
        <span
          >
          {{ votesYes }} / {{ committeeSize }}
          <b>({{ (BigInt(votesYes) * 100n) / BigInt(committeeSize) }}%)</b>
        </span>
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
import type {
  CommitteeActions,
  VoteState,
} from "../../../declarations/vote_me_backend/vote_me_backend.did";
import { committeeActionTitles } from "../utils/titleMapping";

export default {
  props: {
    state: {
      type: Object as PropType<VoteState>,
      required: true,
    },
    action: {
      type: Object as PropType<CommitteeActions>,
      required: true,
    },
    creator: {
      type: String,
      required: true,
    },
    votesYes: {
      type: String,
      required: true,
    },
    committeeSize: {
      type: String,
      required: true,
    },
    id: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const action = Object.keys(props.action)[0];
    const title = (committeeActionTitles as any)[action];
    const state = Object.keys(props.state)[0];

    return {
      title,
      state,
    };
  },
};
</script>
