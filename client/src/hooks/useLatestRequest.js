import { useCallback, useLayoutEffect, useMemo } from 'react';

/**
 * Own one request per committed scope. A callback retained by an older mutation
 * cannot start a request after its filters change or its page unmounts.
 * Pass the returned signal to Axios and check isCurrent before writing state,
 * including error and finally handlers. Shared cached reads only need the guard.
 */
export default function useLatestRequest(scopeKey) {
  const scope = useMemo(() => ({ key: scopeKey, active: false, controller: null }), [scopeKey]);

  const cancelRequest = useCallback(() => {
    scope.controller?.abort();
    scope.controller = null;
  }, [scope]);

  useLayoutEffect(() => {
    scope.active = true;
    return () => {
      scope.active = false;
      cancelRequest();
    };
  }, [scope, cancelRequest]);

  const beginRequest = useCallback(() => {
    if (!scope.active) return null;
    cancelRequest();
    const controller = new AbortController();
    scope.controller = controller;
    return {
      signal: controller.signal,
      isCurrent: () => scope.active && scope.controller === controller && !controller.signal.aborted,
    };
  }, [scope, cancelRequest]);

  return { beginRequest, cancelRequest };
}
