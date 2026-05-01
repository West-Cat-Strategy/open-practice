import { existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const compatibilityRoot = join(root, ".references", "oss");
const referencesRoot = resolve(
  process.env.REFERENCE_REPOS_ROOT ?? join(root, "..", "reference-repos", "repos"),
);

const repositories = [
  ["jlawyerorg__j-lawyer-org", "https://github.com/jlawyerorg/j-lawyer-org.git"],
  ["ArkCase__ArkCase", "https://github.com/ArkCase/ArkCase.git"],
  ["jhpyle__docassemble", "https://github.com/jhpyle/docassemble.git"],
  ["paperless-ngx__paperless-ngx", "https://github.com/paperless-ngx/paperless-ngx.git"],
  ["kimai__kimai", "https://github.com/kimai/kimai.git"],
  ["docusealco__docuseal", "https://github.com/docusealco/docuseal.git"],
  ["opencollective__opencollective", "https://github.com/opencollective/opencollective.git"],
  [
    "opencollective__opencollective-api",
    "https://github.com/opencollective/opencollective-api.git",
  ],
  [
    "opencollective__opencollective-frontend",
    "https://github.com/opencollective/opencollective-frontend.git",
  ],
  ["blnkfinance__blnk", "https://github.com/blnkfinance/blnk.git"],
  ["LerianStudio__midaz", "https://github.com/LerianStudio/midaz.git"],
  ["apache__fineract", "https://github.com/apache/fineract.git"],
  ["civicrm__civicrm-core", "https://github.com/civicrm/civicrm-core.git"],
  ["ledgersmb__LedgerSMB", "https://github.com/ledgersmb/LedgerSMB.git"],
];

function centralDirectoryName(url) {
  const parsed = new URL(url);
  const [owner, repo] = parsed.pathname.replace(/^\/|\.git$/g, "").split("/");
  return `${owner.toLowerCase()}__${repo.toLowerCase()}`;
}

function lstatIfExists(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function ensureCompatibilityLink(directory, target) {
  const link = join(compatibilityRoot, directory);
  const stat = lstatIfExists(link);
  if (stat) {
    if (stat.isSymbolicLink()) {
      const currentTarget = resolve(dirname(link), readlinkSync(link));
      if (currentTarget === target) {
        return;
      }
      rmSync(link);
    } else if (existsSync(join(link, ".git"))) {
      console.warn(`${link} is a local clone; leaving it in place instead of replacing it`);
      return;
    } else {
      throw new Error(`${link} exists but is not a reference repo or symlink`);
    }
  }

  symlinkSync(target, link, "dir");
}

mkdirSync(referencesRoot, { recursive: true });
mkdirSync(compatibilityRoot, { recursive: true });

for (const [directory, url] of repositories) {
  const target = join(referencesRoot, centralDirectoryName(url));
  if (existsSync(join(target, ".git"))) {
    console.log(`Already cloned: ${target}`);
    ensureCompatibilityLink(directory, target);
    continue;
  }

  mkdirSync(dirname(target), { recursive: true });
  console.log(`Cloning ${url} -> ${target}`);
  const result = spawnSync("git", ["clone", "--depth", "1", "--filter=blob:none", url, target], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }

  ensureCompatibilityLink(directory, target);
}
