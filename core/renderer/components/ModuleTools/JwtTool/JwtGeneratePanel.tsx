import { useCallback, useState, type ChangeEvent } from 'react';
import { VscKey } from 'react-icons/vsc';
import { ToolButton, ToolField, ToolInput, ToolSection, ToolSelect } from '@@components';
import { Block, JsonArea } from './JwtBlocks';
import { generateHmacJwt } from './JwtTool.model';
import type { JwtCopyHandler, JwtLocaleText } from './JwtTool.types';
import styles from './JwtTool.module.css';

export function JwtGeneratePanel({ mt, onCopy }: { mt: JwtLocaleText; onCopy: JwtCopyHandler }) {
  const [alg, setAlg] = useState('HS256');
  const [secret, setSecret] = useState('');
  const [header, setHeader] = useState('{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
  const [payload, setPayload] = useState(
    '{\n  "sub": "1234567890",\n  "name": "Test",\n  "iat": ' + Math.floor(Date.now() / 1000) + '\n}',
  );
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const handleGenerate = useCallback(async () => {
    setError('');
    setOutput('');
    const result = await generateHmacJwt(alg, secret, header, payload);
    if (result.ok) setOutput(result.token);
    else setError(result.error || mt('generateError'));
  }, [alg, header, mt, payload, secret]);

  return (
    <ToolSection
      title={mt('tabGenerate')}
      icon={<VscKey />}
      accentColor="#f39c12"
      actions={
        <ToolButton variant="primary" onClick={handleGenerate}>
          {mt('generateBtn')}
        </ToolButton>
      }
    >
      <div className={styles.row}>
        <ToolField label={mt('algorithm')}>
          <ToolSelect
            value={alg}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setAlg(event.target.value)}
          >
            <option>HS256</option>
            <option>HS384</option>
            <option>HS512</option>
          </ToolSelect>
        </ToolField>
        <ToolField label={mt('secret')}>
          <ToolInput
            value={secret}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSecret(event.target.value)}
            placeholder={mt('secretPlaceholder')}
            spellCheck={false}
          />
        </ToolField>
      </div>
      <JsonArea label={mt('headerInput')} value={header} onChange={setHeader} rows={4} />
      <JsonArea label={mt('payloadInput')} value={payload} onChange={setPayload} rows={6} />
      {error && <div className={styles.err}>{error}</div>}
      {output && (
        <Block title={mt('generatedToken')} copyLabel={mt('copy')} onCopy={() => onCopy(output)}>
          <code className={styles.tok}>{output}</code>
        </Block>
      )}
    </ToolSection>
  );
}
