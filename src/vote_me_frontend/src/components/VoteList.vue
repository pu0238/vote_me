<template>
  <div class="text-white my-10">
    <div class="flex w-full bg-black/50 text-xl font-bold">
      <button
        class="px-4 w-1/2 py-4 text-center"
        :class="{
          'border-b-4': activeTab === 'CommitteeProposals',
        }"
        @click="activeTab = 'CommitteeProposals'"
      >
        Glosowania komisji
      </button>
      <button
        class="px-4 w-1/2 py-4 text-center"
        :class="{
          'border-b-4': activeTab === 'UserProposals',
        }"
        @click="activeTab = 'UserProposals'"
      >
        Glosowania obywatelskie
      </button>
    </div>
    <Suspense>
      <CommitteeVoteItem
        v-if="activeTab === 'CommitteeProposals'"
        v-for="proposal in committeeProposals"
        :action="proposal.action"
        :creator="proposal.creator.toString()"
        :votesYes="proposal.votes_yes.toString()"
        :committeeSize="committeeSize"
        :state="proposal.state"
        :id="proposal.id.toString()"
      />
    </Suspense>
    <Suspense>
      <PresidentialElectionsList
        v-if="activeTab === 'UserProposals'"
        v-for="proposal in presidentialElections"
        :creator="proposal.creator.toString()"
        :votesYes="(proposal.votes_yes as any)"
        :usersCount="usersCount.toString()"
        :state="proposal.state"
        :proposalContent="proposal.proposal_content"
        :id="proposal.id.toString()"
      />
    </Suspense>
  </div>
</template>

<script lang="ts">
import CommitteeVoteItem from "./CommitteeVoteItem.vue";
import PresidentialElectionsList from "./PresidentialElectionsList.vue";
import { getVoteMeBackend } from "../utils/vote_me_backend";
import { ref } from "vue";

const activeTab = ref("CommitteeProposals");

export default {
  components: { CommitteeVoteItem, PresidentialElectionsList },
  async setup() {
    const queryClienst = getVoteMeBackend();
    const committeeProposals = await queryClienst.get_committee_proposals();
    const presidentialElections =
      await queryClienst.get_presidential_elections();
    const committeeSize = await queryClienst.get_committee_size();
    const usersCount = await queryClienst.get_users_count();

    return {
      committeeProposals,
      committeeSize: committeeSize.toString(),
      activeTab,
      presidentialElections,
      usersCount
    };
  },
};
</script>
