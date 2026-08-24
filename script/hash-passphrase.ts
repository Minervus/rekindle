import bcrypt from "bcrypt";

const passphrase = process.argv[2];
if (!passphrase) {
  console.error("Usage: npm run hash-passphrase -- \"your-passphrase\"");
  process.exit(1);
}

console.log(bcrypt.hashSync(passphrase, 12));
