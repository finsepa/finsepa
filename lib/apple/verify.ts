import "server-only";

import {
  Environment,
  SignedDataVerifier,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";

import { APPLE_BUNDLE_ID } from "@/lib/apple/products";
import { appleRootCaG3Der } from "@/lib/apple/root-ca";

const ENVIRONMENTS = [Environment.PRODUCTION, Environment.SANDBOX, Environment.XCODE] as const;

function verifier(environment: Environment): SignedDataVerifier {
  return new SignedDataVerifier([appleRootCaG3Der()], false, environment, APPLE_BUNDLE_ID);
}

export async function verifyAppleTransaction(
  signedTransaction: string,
): Promise<JWSTransactionDecodedPayload> {
  let lastError: unknown;
  for (const environment of ENVIRONMENTS) {
    try {
      return await verifier(environment).verifyAndDecodeTransaction(signedTransaction);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Invalid Apple transaction.");
}

export async function verifyAppleRenewalInfo(
  signedRenewalInfo: string,
): Promise<JWSRenewalInfoDecodedPayload> {
  let lastError: unknown;
  for (const environment of ENVIRONMENTS) {
    try {
      return await verifier(environment).verifyAndDecodeRenewalInfo(signedRenewalInfo);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Invalid Apple renewal info.");
}

export async function verifyAppleNotification(
  signedPayload: string,
): Promise<ResponseBodyV2DecodedPayload> {
  let lastError: unknown;
  for (const environment of ENVIRONMENTS) {
    try {
      return await verifier(environment).verifyAndDecodeNotification(signedPayload);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Invalid Apple notification.");
}
