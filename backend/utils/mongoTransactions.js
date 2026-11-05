/**
 * Helpers for detecting when the connected MongoDB deployment cannot run
 * multi-document transactions (for example a standalone mongod). Callers use
 * this to fall back to explicit compensation instead of returning a generic
 * 500 to the client.
 */

const NO_TRANSACTION_SUPPORT_PATTERNS = [
  /transaction numbers are only allowed/i,
  /does not support retryable writes/i,
  /does not support (?:multi-document )?transactions/i,
  /add retryWrites=false/i,
  /transactions are not supported/i
];

/**
 * Gather message text from an error and everything the driver nested inside
 * it (mongoose and the Node driver wrap server errors in `originalError` /
 * `errorResponse` rather than `cause`).
 */
export const collectErrorText = (error) => {
  const texts = [];
  const seen = new Set();
  let current = error;

  while (current && !seen.has(current)) {
    seen.add(current);
    texts.push(
      current.message,
      current.errmsg,
      current.errorResponse?.message,
      current.errorResponse?.errmsg
    );
    current = current.cause || current.originalError || current.errorResponse?.originalError;
  }

  return texts.filter(Boolean).join(" | ");
};

/**
 * True when the connected server cannot run multi-document transactions
 * (e.g. a standalone mongod, or a free/shared tier with the feature off).
 */
export const isTransactionUnsupported = (error) => {
  if (!error) return false;

  const text = collectErrorText(error);
  if (!text) return false;

  if (NO_TRANSACTION_SUPPORT_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  // code 20 = IllegalOperation, the server's response to a transaction or
  // retryable write on a deployment that does not support them.
  const code = error.code ?? error.originalError?.code ?? error.errorResponse?.code;
  const illegalOperation = code === 20 || error.codeName === "IllegalOperation";

  return illegalOperation && /transaction|retryable|retryWrites/i.test(text);
};
