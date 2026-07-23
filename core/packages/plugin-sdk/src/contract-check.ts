import type { PluginSdkError, PluginSdkMethod, PluginSdkResponse, PluginSdkResult } from '@devtoolbox/core';
import type { SdkError, SdkMethod, SdkResponse, SdkResult } from './index';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;
type Assert<Value extends true> = Value;

export type SdkMethodContractMatches = Assert<Equal<SdkMethod, PluginSdkMethod>>;
export type SdkErrorContractMatches = Assert<Equal<SdkError, PluginSdkError>>;
export type SdkResultContractMatches = Assert<Equal<SdkResult<string>, PluginSdkResult<string>>>;
export type SdkResponseContractMatches = Assert<Equal<SdkResponse, PluginSdkResponse>>;
