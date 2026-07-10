// The merchant's ten lines: gate a paid endpoint on a Custos check.
//
//   import { custosGate } from '@custos/middleware-express';
//   app.get('/api/data', custosGate({ trustList, registry, scorer,
//     price: '10000', asset: 'usdc-base', payTo: '0xMERCHANT', minTier: 1 }), handler);
//
// Flow (x402-style): no payment/credential -> 402 with requirements;
// credential present -> verify presentation (bound to payment + host) -> score
// -> allow / step-up / block. Verification result lands on req.custos.

import { verifyPresentation } from '@custos/kya-sdk';

export function custosGate({ trustList, registry, scorer, price, asset, payTo, minTier = 1 }) {
  return (req, res, next) => {
    const payment = req.header('x-payment');
    const credential = req.header('x-agent-credential');

    if (!payment || !credential) {
      return res.status(402).json({
        x402Version: 1,
        error: !payment ? 'payment required' : 'agent credential required',
        accepts: [
          {
            scheme: 'exact',
            asset,
            payTo,
            maxAmountRequired: price,
            extra: { kyaRequired: true, minAssuranceTier: minTier, spec: 'https://kya.dev/spec/0.1' },
          },
        ],
      });
    }

    const verification = verifyPresentation(credential, {
      audience: req.headers.host,
      paymentPayload: payment,
      trustList,
      registry,
    });

    if (!verification.valid) {
      return res.status(403).json({ error: 'agent credential rejected', reasons: verification.errors });
    }
    if (verification.tier < minTier) {
      return res.status(403).json({ error: `assurance tier ${verification.tier} below required ${minTier}` });
    }

    const risk = scorer.score({ verification, payment: JSON.parse(payment) });
    if (risk.verdict === 'block') {
      return res.status(403).json({ error: 'blocked by risk policy', risk: risk.risk, components: risk.components });
    }
    if (risk.verdict === 'review') {
      return res.status(403).json({ error: 'step-up required', action: 'review', risk: risk.risk, components: risk.components });
    }

    req.custos = { ...verification, risk };
    next();
  };
}
