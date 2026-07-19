const [major] = process.versions.node.split(".").map(Number);

if (major !== 22) {
  console.error(
    `Unsupported Node.js runtime ${process.versions.node}. Veterans Bay requires Node.js 22.x.`,
  );
  process.exit(1);
}

const userAgent = process.env.npm_config_user_agent;

if (userAgent && !userAgent.startsWith("npm/")) {
  console.error("Unsupported package manager. Veterans Bay uses npm.");
  process.exit(1);
}

console.log(`Runtime ready: Node.js ${process.versions.node}.`);
