/**
 * 模板注册中心
 */
import v8 from './maccms_v8.js';
import v10 from './maccms_v10.js';
import api from './api_collect.js';
import nonstandard from './nonstandard.js';
import { playerOverrides, detailOverrides } from './overrides.js';

const templates = {
  maccms_v8: v8,
  maccms_v10: v10,
  api_collect: api,
  unknown: nonstandard
};

export function getTemplateGenerator (cmsType, _modular = false) {
  return templates[cmsType] || templates.unknown;
}

export { playerOverrides, detailOverrides };
