import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const referencesRoot = join(root, ".references", "oss");

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

mkdirSync(referencesRoot, { recursive: true });

for (const [directory, url] of repositories) {
  const target = join(referencesRoot, directory);
  if (existsSync(join(target, ".git"))) {
    console.log(`Already cloned: ${directory}`);
    continue;
  }

  mkdirSync(dirname(target), { recursive: true });
  console.log(`Cloning ${url} -> ${target}`);
  const result = spawnSync("git", ["clone", "--depth", "1", url, target], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
