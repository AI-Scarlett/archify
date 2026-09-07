import * as skillFilesystem from '@deepseek-ai/dsh-skill-filesystem';

export const name = 'archify-dsh';
export const inject = ['skills'];
export { PACKAGE_NAME, resolveArchifySkillRoot } from './resolve-skill-root.js';
export const Config = skillFilesystem.Config;

// Keep the Cordis patch owned by this package while delegating only to DSH's
// documented filesystem Skill provider. This makes the runtime surface
// explicit without patching or shadowing an official DSH package.
export function apply(ctx, config = {}) {
  return skillFilesystem.apply(ctx, config);
}
