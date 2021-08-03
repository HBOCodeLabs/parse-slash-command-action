#!/usr/bin/env node

// Copyright (c) WarnerMedia Direct, LLC. All rights reserved. Licensed under the MIT license.
// See the LICENSE file for license information.

const { execSync } = require('child_process');
const fs = require('fs');

function verifyCleanWorkspace() {
    const output = execSync(`git status --porcelain`, { encoding: 'utf8' });
    if (output !== '') {
        console.log(`ERROR: Working copy should not contain any uncommitted or untracked files:\n${output}`);
        process.exit(2);
    }
}

function verifyNotYetPublished(fullVersion) {
    try {
        execSync(`git show-ref --quiet --verify refs/remotes/origin/snapshot/${fullVersion}`, { encoding: 'utf8' });
        console.log(`Version ${fullVersion} already published, nothing to do.`);
        process.exit(0);
    } catch { }
}

function createSnapshotBranch(fullVersion) {
    execSync(`git checkout -b snapshot/${fullVersion}`, { stdio: 'inherit' });
}

function editGitIgnoreFile() {
    let lines = fs.readFileSync('.gitignore', 'utf8').split(/\r?\n/);
    lines = lines.map(line => line.replace(/^dist$/, '# dist'));
    fs.writeFileSync('.gitignore', lines.join('\n'));
}

function bundleAction() {
    execSync(`npm run bundle`, { stdio: 'inherit' });
}

function pushSnapshotBranch(fullVersion) {
    execSync(`git add .gitignore`, { stdio: 'inherit' });
    execSync(`git add dist`, { stdio: 'inherit' });
    execSync(`git commit -m ":bookmark: ${fullVersion}"`, { stdio: 'inherit' });
    execSync(`git push -u origin HEAD`, { stdio: 'inherit' });
}

function tagVersion(fullVersion) {
    execSync(`git tag ${fullVersion}`, { stdio: 'inherit' });
    execSync(`git push --tags`, { stdio: 'inherit' });
}

function pushMajorVersionBranch(majorVersion) {
    try {
        execSync(`git branch -D ${majorVersion}`, { stdio: 'inherit' });
    } catch { }

    execSync(`git checkout -b ${majorVersion}`, { stdio: 'inherit' });
    execSync(`git push -f -u origin HEAD`, { stdio: 'inherit' });
}

function publish() {
    const fullVersion = 'v' + JSON.parse(fs.readFileSync('package.json')).version;
    const majorVersion = fullVersion.split('.')[0];

    verifyCleanWorkspace();

    console.log(`#### Checking if ${fullVersion} already exists...`);
    verifyNotYetPublished(fullVersion);

    console.log(`\n#### Creating snapshot branch for ${fullVersion}...`);
    createSnapshotBranch(fullVersion);

    console.log('\n#### Updating the .gitignore file...');
    editGitIgnoreFile();

    console.log('\n#### Building action...');
    bundleAction();

    console.log(`\n#### Pushing branch snapshot/${fullVersion}...`);
    pushSnapshotBranch(fullVersion);

    console.log(`\n#### Tagging version ${fullVersion}...`);
    tagVersion(fullVersion);

    console.log(`\n#### Updating branch ${majorVersion}...`);
    pushMajorVersionBranch(majorVersion);

    console.log('\n#### Done.');
}

publish();
