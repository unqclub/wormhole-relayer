import { Transaction, VersionedMessage } from "@solana/web3.js";

export const transactionParser = () => {
  const tx = VersionedMessage.deserialize(
    Buffer.from(
      "67fTXH2XG8JbzuFvRPaDrwHxQjUsXZU3mcEWETY4jspfXy6n88xGYVEiMvXRNpqUinDoxtWbBqG3UuCcFzKy8yMpX913hNp9Cx43uCTef6fP9q29i4xvCEFYHRJAXDvgQneWsDm7PhyBuBvs6aLuvUZzUESXG7J8jW2EAofsEg6thK3Kq1iomPKknG8R8iiYTvSoocPHfqeyRcj1YPSyv2Eqam3oFGjbnhGuzRK1kkHwSJCEhKrZdyqaQ8bQSGepbhrQhUsJ6paKKnUMywNHXQuKa1FEV72ZKuaSSBvYCoaNMtGiGqj2NsvJGdgvALLD248JgPthsSbKwd8k9a9MrcnLX4DyuJU6yvzC2qtTmDjQHgGHWCfKkbn5kGFmPoEUg7LPxKmBL1177Xqw3GQrnfyTZR55CriqNUJWRWnVx16jc7xxheEJmgjFk3rDB18Nax3qc8TLCztGVVQ2dAqivF12cwpSQonXbMuuk4vM5FvcohJcG2SLt66gSE1G7PdSiX459jf2ZwjYon3LF1EwWVHYVQyc2kzJRGmUUq3rs2kKvx887AQA7vKTtts8g11DvwZoupw14R7FbNsxqWYh25qhrf3W48dSWbFdSdx2LVdGzTv3c2NpAy7J3S7pUfeb3yaKhdZSaXwkxV2aZreqJYCWME8kPgc4ozrQhGCEdxgHNMks6q8BRzzq62uhxRrfz2YdXwymvNibbcQiqC7yrK2Gdusajvp2VfEvNxYPRaC5mnC3Tn9ZbXUgbMmAYzA59Hq"
    )
  );
  const accKeys = tx.staticAccountKeys;

  accKeys.forEach((accKey) => {
    console.log(accKey.toBase58());
  });
};

transactionParser();
