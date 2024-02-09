<template>
  <div class="text-white px-10 py-6 bg-black">
    <div class="container mx-auto flex justify-between">
      <img src="/VoteMe.svg" width="120" />
      <!--
        <button class="font-bold text-black bg-white px-4 py-2" @click="logInOpen=true">Log in</button>
      -->
    </div>
    <DarkBg v-if="logInOpen" @click="logInOpen=false"/>
    <LogIn v-if="logInOpen" @close="logInOpen=false"/>
  </div>
</template>

<script lang="ts">
import DarkBg from "./DarkBg.vue"
import LogIn from "./LogIn.vue"

export default {
  components: {DarkBg, LogIn},
  data () {
    return {
      logInOpen: false
    }
  }
}
</script>