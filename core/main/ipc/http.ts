import { ipcMain } from 'electron';
import {
  ExternalHttpError,
  requestExternal,
  type ExternalHttpParams,
  type ExternalHttpResult,
} from './safe-http';
import { validateHttpRequestParams } from './validation';

type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export function register(): void {
  ipcMain.handle('http:request', async (_event, input: unknown): Promise<Result<ExternalHttpResult>> => {
    const validated = validateHttpRequestParams(input);
    if (!validated.ok) {
      return { ok: false, error: { code: 'invalid_params', message: validated.error } };
    }
    const params: ExternalHttpParams & { allowHttp?: boolean } = validated.data;
    try {
      const data = await requestExternal(params, { allowHttp: Boolean(params?.allowHttp) });
      return { ok: true, data };
    } catch (error) {
      if (error instanceof ExternalHttpError) {
        return { ok: false, error: { code: error.code, message: error.message } };
      }
      return {
        ok: false,
        error: { code: 'network_error', message: error instanceof Error ? error.message : String(error) },
      };
    }
  });
}
