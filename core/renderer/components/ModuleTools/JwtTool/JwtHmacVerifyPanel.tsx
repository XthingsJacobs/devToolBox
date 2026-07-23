import { useCallback, useState, type ChangeEvent } from 'react';
import { VscShield } from 'react-icons/vsc';
import { ToolButton, ToolField, ToolInput, ToolSection, ToolTextarea } from '@@components';
import { VerifyBadges } from './JwtBlocks';
import { verifyHmacJwt } from './JwtTool.model';
import type { JwtLocaleText, VerifyMessage } from './JwtTool.types';

export function JwtHmacVerifyPanel({ mt }: { mt: JwtLocaleText }) {
  const [token, setToken] = useState('');
  const [secret, setSecret] = useState('');
  const [result, setResult] = useState<VerifyMessage[]>([]);

  const handleVerify = useCallback(async () => {
    setResult([]);
    const messages = await verifyHmacJwt(token, secret, {
      decodeError: mt('decodeError'),
      verifyValid: mt('verifyValid'),
      verifyInvalid: mt('verifyInvalid'),
      verifyExpired: mt('verifyExpired'),
      verifyNotBefore: mt('verifyNotBefore'),
    });
    setResult(messages);
  }, [mt, secret, token]);

  return (
    <ToolSection
      title={mt('tabVerifyHmac')}
      icon={<VscShield />}
      accentColor="#27ae60"
      actions={
        <ToolButton variant="primary" onClick={handleVerify} disabled={!token.trim()}>
          {mt('verifyBtn')}
        </ToolButton>
      }
    >
      <ToolTextarea
        mono
        value={token}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setToken(event.target.value)}
        placeholder={mt('inputPlaceholder')}
        spellCheck={false}
        rows={2}
      />
      <ToolField label={mt('verifySecret')}>
        <ToolInput
          value={secret}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setSecret(event.target.value)}
          placeholder={mt('verifySecretPlaceholder')}
          spellCheck={false}
        />
      </ToolField>
      <VerifyBadges messages={result} />
    </ToolSection>
  );
}
