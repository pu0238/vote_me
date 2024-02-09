<template>
  <div
    class="fixed grid top-0 left-0 w-full h-full justify-center content-center"
  >
    <div class="w-96 bg-black mx-auto pb-6" v-if="activeTab === 'login'">
      <div class="text-xl font-bold px-8 py-6 flex justify-between">
        <h3>Zaloguj sie</h3>
        <button @click="$emit('close')">X</button>
      </div>
      <div class="px-10 flex flex-col justify-between">
        <div class="grid">
          <div class="grid py-2">
            <span class="pb-2 font-bold">Nazwa użytkownika</span>
            <input
              placeholder="Nazwa użytkownika"
              class="py-2 px-4 text-black outline-none"
              v-model="loginPesel"
            />
          </div>
          <div class="grid py-2">
            <span class="pb-2 font-bold">Hasło</span>
            <input
              placeholder="Hasło"
              class="py-2 px-4 text-black outline-none"
              v-model="loginPassword"
            />
          </div>
          <div class="grid py-2">
            <span class="pb-2 font-bold">Bezpieczne słowo</span>
            <input
              placeholder="Bezpieczne słowo"
              class="py-2 px-4 text-black outline-none"
              v-model="loginSafeWord"
            />
          </div>
        </div>
        <div class="flex justify-between font-bold">
          <button @click="activeTab = 'active'">Aktywuj konto</button>
          <button @click="logIn()" class="bg-green-500 px-4 py-2 font-bold">
            Zaloguj sie
          </button>
        </div>
      </div>
    </div>
    <div class="w-96 bg-black mx-auto pb-6" v-if="activeTab === 'active'">
      <div class="text-xl font-bold px-8 py-6 flex justify-between">
        <h3>Aktywuj konto</h3>
        <button @click="$emit('close')">X</button>
      </div>
      <div class="px-10 flex flex-col justify-between">
        <div class="grid">
          <div class="grid py-2">
            <span class="pb-2 font-bold">Pesel</span>
            <input
              placeholder="Pesel"
              class="py-2 px-4 text-black outline-none"
              v-model="activePesel"
            />
          </div>
          <div class="grid py-2">
            <span class="pb-2 font-bold">Numer dowodu"</span>
            <input
              placeholder="Numer dowodu"
              class="py-2 px-4 text-black outline-none"
              v-model="activeIdNumber"
            />
          </div>
          <div class="grid py-2">
            <span class="pb-2 font-bold">Pin</span>
            <input
              placeholder="Pin"
              class="py-2 px-4 text-black outline-none"
              v-model="activePin"
            />
          </div>
          <div class="grid py-2">
            <span class="pb-2 font-bold">Bezpieczne słowo</span>
            <input
              placeholder="Bezpieczne słowo"
              class="py-2 px-4 text-black outline-none"
              v-model="activeExternalFactor"
            />
          </div>
        </div>
        <div class="flex justify-between font-bold">
          <button @click="activeTab = 'login'">Zaloguj sie</button>
          <button
            @click="activateAccount()"
            class="bg-green-500 px-4 py-2 font-bold"
          >
            Aktywuj konto
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Ed25519KeyIdentity } from "@dfinity/identity";
import {
  getEntryUserIdentity,
  getUserIdentity,
} from "../../../../utils/identity";
import { getVoteMeBackend } from "../utils/vote_me_backend";
import { aes_gcm_decrypt } from "../../../../utils/cryptoHelpers";

export default {
  emits: ["close"],
  data() {
    return {
      activeTab: "login",

      activePesel: "",
      activeIdNumber: "",
      activePin: "",
      activeExternalFactor: "",

      loginPesel: "",
      loginPassword: "",
      loginSafeWord: "",

      error: null as null | string,
    };
  },
  methods: {
    async logIn() {
        console.log(45)
      const cachedEntryIdentity = localStorage.getItem("entryIdentity");
      if (cachedEntryIdentity === null) {
        this.error = "Wczesna tożsamość nie ustawiona";
        return;
      }
      const entryIdentity = Ed25519KeyIdentity.fromJSON(cachedEntryIdentity);
      console.log(entryIdentity.getPrincipal().toString(), 9999)

      const salt = await getVoteMeBackend(entryIdentity).get_salt();
      console.log({salt})
      const decryptedSalt = await aes_gcm_decrypt(
        salt,
        entryIdentity.getKeyPair().secretKey
      );
      console.log({decryptedSalt})

      const identity = getUserIdentity(
        this.loginPesel,
        this.loginPassword,
        this.loginSafeWord,
        decryptedSalt
      );
      console.log("Entry identity ", entryIdentity.getPrincipal().toString());
      console.log("Identity ", identity.getPrincipal().toString());
    },
    activateAccount() {
      const entryIdentity = getEntryUserIdentity(
        this.activePesel,
        this.activeIdNumber,
        this.activePin,
        this.activeExternalFactor
      );

      console.log("Entry identity ", entryIdentity.getPrincipal().toString());
      localStorage.setItem(
        "entryIdentity",
        JSON.stringify(entryIdentity.toJSON())
      );
      this.activeTab = "login";
    },
  },
};
</script>
