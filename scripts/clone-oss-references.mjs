import {
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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
  ["NodineLegal__OpenLawOffice", "https://github.com/NodineLegal/OpenLawOffice.git"],
  ["jhpyle__docassemble", "https://github.com/jhpyle/docassemble.git"],
  ["paperless-ngx__paperless-ngx", "https://github.com/paperless-ngx/paperless-ngx.git"],
  ["papermerge__papermerge-core", "https://github.com/papermerge/papermerge-core.git"],
  ["mayan-edms__Mayan-EDMS", "https://github.com/mayan-edms/Mayan-EDMS.git"],
  ["Open-Source-Legal__OpenContracts", "https://github.com/Open-Source-Legal/OpenContracts.git"],
  ["kimai__kimai", "https://github.com/kimai/kimai.git"],
  ["docusealco__docuseal", "https://github.com/docusealco/docuseal.git"],
  ["documenso__documenso", "https://github.com/documenso/documenso.git"],
  ["opencollective__opencollective", "https://github.com/opencollective/opencollective.git"],
  [
    "opencollective__opencollective-api",
    "https://github.com/opencollective/opencollective-api.git",
  ],
  [
    "opencollective__opencollective-frontend",
    "https://github.com/opencollective/opencollective-frontend.git",
  ],
  ["nextcloud__server", "https://github.com/nextcloud/server.git"],
  ["espocrm__espocrm", "https://github.com/espocrm/espocrm.git"],
  ["SuiteCRM__SuiteCRM-Core", "https://github.com/SuiteCRM/SuiteCRM-Core.git"],
  ["twentyhq__twenty", "https://github.com/twentyhq/twenty.git"],
  ["formbricks__formbricks", "https://github.com/formbricks/formbricks.git"],
  ["chatwoot__chatwoot", "https://github.com/chatwoot/chatwoot.git"],
  ["zulip__zulip", "https://github.com/zulip/zulip.git"],
  ["jitsi__jitsi-meet", "https://github.com/jitsi/jitsi-meet.git"],
  ["element-hq__synapse", "https://github.com/element-hq/synapse.git"],
  ["mattermost__mattermost", "https://github.com/mattermost/mattermost.git"],
  ["calcom__cal.com", "https://github.com/calcom/cal.com.git"],
  ["activepieces__activepieces", "https://github.com/activepieces/activepieces.git"],
  ["surveyjs__survey-library", "https://github.com/surveyjs/survey-library.git"],
  ["apache__camel", "https://github.com/apache/camel.git"],
  ["temporalio__temporal", "https://github.com/temporalio/temporal.git"],
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

function relativeCentralPath(url) {
  return `../reference-repos/repos/${centralDirectoryName(url)}`;
}

mkdirSync(referencesRoot, { recursive: true });
mkdirSync(compatibilityRoot, { recursive: true });

const lockEntries = [];

for (const [directory, url] of repositories) {
  const target = join(referencesRoot, centralDirectoryName(url));
  if (existsSync(join(target, ".git"))) {
    console.log(`Refreshing ${target}`);
    const fetchResult = spawnSync("git", ["-C", target, "fetch", "--depth", "1", "origin"], {
      stdio: "inherit",
    });
    if (fetchResult.status !== 0) {
      process.exitCode = fetchResult.status ?? 1;
      break;
    }
    const resetResult = spawnSync("git", ["-C", target, "reset", "--hard", "FETCH_HEAD"], {
      stdio: "inherit",
    });
    if (resetResult.status !== 0) {
      process.exitCode = resetResult.status ?? 1;
      break;
    }
  } else {
    mkdirSync(dirname(target), { recursive: true });
    console.log(`Cloning ${url} -> ${target}`);
    const result = spawnSync("git", ["clone", "--depth", "1", "--filter=blob:none", url, target], {
      stdio: "inherit",
    });

    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      break;
    }
  }

  const commitResult = spawnSync("git", ["-C", target, "rev-parse", "HEAD"], {
    encoding: "utf8",
  });
  if (commitResult.status !== 0) {
    process.exitCode = commitResult.status ?? 1;
    break;
  }
  lockEntries.push({
    name: directory,
    url,
    commit: commitResult.stdout.trim(),
    centralPath: relativeCentralPath(url),
    compatibilityPath: `.references/oss/${directory}`,
  });
  ensureCompatibilityLink(directory, target);
}

if (!process.exitCode) {
  writeFileSync(
    join(root, "docs", "oss-references.lock.json"),
    `${JSON.stringify({ generatedFrom: "pnpm refs:clone", references: lockEntries }, null, 2)}\n`,
  );
}
