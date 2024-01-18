import { execSync } from "child_process";

export const startBlockchainInBg = (silent = true) => {
  const command = `dfx start --emulator --background`;

  execSync(command, { stdio: silent ? "ignore" : "inherit" });
};

export const stopBlockchain = (silent = true) => {
    const command = `dfx stop`;
  
    execSync(command, { stdio: silent ? "ignore" : "inherit" });
  };