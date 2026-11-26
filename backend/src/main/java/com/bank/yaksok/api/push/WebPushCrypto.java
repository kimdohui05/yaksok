package com.bank.yaksok.api.push;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;
import java.util.Base64;

/**
 * 웹 푸시 암호화(RFC 8291, aes128gcm)와 VAPID 서명(RFC 8292)을 JDK 기본 기능만으로 구현.
 * 외부 라이브러리 없이 동작하도록 직접 만들었다. 키는 모두 P-256(secp256r1).
 */
public final class WebPushCrypto {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder B64URL = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64URL_DEC = Base64.getUrlDecoder();
    private static final int RECORD_SIZE = 4096;

    private WebPushCrypto() {}

    // ───── 키 변환 ─────

    static ECParameterSpec p256() {
        try {
            AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
            params.init(new ECGenParameterSpec("secp256r1"));
            return params.getParameterSpec(ECParameterSpec.class);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("P-256 을 사용할 수 없습니다.", e);
        }
    }

    /** base64url (패딩 있어도 됨) → 바이트 */
    public static byte[] decode(String base64url) {
        return B64URL_DEC.decode(base64url.trim().replace('+', '-').replace('/', '_').replaceAll("=+$", ""));
    }

    public static String encode(byte[] bytes) {
        return B64URL.encodeToString(bytes);
    }

    /** 65바이트(0x04 || x || y) → 공개키 */
    public static ECPublicKey publicKey(byte[] uncompressed) throws GeneralSecurityException {
        if (uncompressed.length != 65 || uncompressed[0] != 0x04) {
            throw new GeneralSecurityException("공개키 형식이 올바르지 않습니다.");
        }
        BigInteger x = new BigInteger(1, Arrays.copyOfRange(uncompressed, 1, 33));
        BigInteger y = new BigInteger(1, Arrays.copyOfRange(uncompressed, 33, 65));
        return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(new ECPoint(x, y), p256()));
    }

    /** 32바이트 d → 개인키 */
    public static ECPrivateKey privateKey(byte[] d) throws GeneralSecurityException {
        if (d.length != 32) {
            throw new GeneralSecurityException("개인키 형식이 올바르지 않습니다.");
        }
        return (ECPrivateKey) KeyFactory.getInstance("EC").generatePrivate(new ECPrivateKeySpec(new BigInteger(1, d), p256()));
    }

    /** 공개키 → 65바이트(0x04 || x || y) */
    public static byte[] raw(ECPublicKey key) {
        byte[] out = new byte[65];
        out[0] = 0x04;
        copyFixed(key.getW().getAffineX(), out, 1);
        copyFixed(key.getW().getAffineY(), out, 33);
        return out;
    }

    /** 개인키 → 32바이트 d */
    public static byte[] raw(ECPrivateKey key) {
        byte[] out = new byte[32];
        copyFixed(key.getS(), out, 0);
        return out;
    }

    private static void copyFixed(BigInteger v, byte[] out, int offset) {
        byte[] b = v.toByteArray();
        int len = Math.min(b.length, 32);
        System.arraycopy(b, b.length - len, out, offset + 32 - len, len);
    }

    public static KeyPair generateKeyPair() throws GeneralSecurityException {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
        gen.initialize(new ECGenParameterSpec("secp256r1"), RANDOM);
        return gen.generateKeyPair();
    }

    // ───── RFC 8291 암호화 ─────

    /**
     * 푸시 내용 암호화. 결과는 그대로 HTTP 본문으로 보낸다 (Content-Encoding: aes128gcm).
     *
     * @param plaintext  보낼 내용 (JSON 바이트, 최대 약 3,900바이트)
     * @param uaPublic   구독 정보 keys.p256dh (65바이트)
     * @param authSecret 구독 정보 keys.auth (16바이트)
     */
    public static byte[] encrypt(byte[] plaintext, byte[] uaPublic, byte[] authSecret) throws GeneralSecurityException {
        return encrypt(plaintext, uaPublic, authSecret, generateKeyPair(), randomBytes(16));
    }

    /** 테스트용: 임시 키와 salt 를 지정 */
    static byte[] encrypt(byte[] plaintext, byte[] uaPublic, byte[] authSecret, KeyPair asKeys, byte[] salt)
            throws GeneralSecurityException {
        if (plaintext.length > RECORD_SIZE - 16 - 1 - 86) {
            throw new GeneralSecurityException("푸시 내용이 너무 깁니다.");
        }
        byte[] asPublic = raw((ECPublicKey) asKeys.getPublic());

        KeyAgreement ka = KeyAgreement.getInstance("ECDH");
        ka.init(asKeys.getPrivate());
        ka.doPhase(publicKey(uaPublic), true);
        byte[] ecdhSecret = ka.generateSecret();

        // IKM = HKDF(salt=auth_secret, ikm=ecdh_secret, info="WebPush: info" 0x00 ua_public as_public, L=32)
        byte[] keyInfo = concat("WebPush: info".getBytes(StandardCharsets.US_ASCII), new byte[]{0}, uaPublic, asPublic);
        byte[] ikm = hkdf(authSecret, ecdhSecret, keyInfo, 32);

        byte[] cek = hkdf(salt, ikm, concat("Content-Encoding: aes128gcm".getBytes(StandardCharsets.US_ASCII), new byte[]{0}), 16);
        byte[] nonce = hkdf(salt, ikm, concat("Content-Encoding: nonce".getBytes(StandardCharsets.US_ASCII), new byte[]{0}), 12);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] ciphertext = cipher.doFinal(concat(plaintext, new byte[]{2})); // 0x02: 마지막 레코드 구분자

        // 헤더: salt(16) || rs(4) || idlen(1) || keyid(as_public 65)
        ByteBuffer header = ByteBuffer.allocate(16 + 4 + 1 + asPublic.length);
        header.put(salt).putInt(RECORD_SIZE).put((byte) asPublic.length).put(asPublic);
        return concat(header.array(), ciphertext);
    }

    /** HKDF-SHA256 (추출 + 확장, 32바이트 이하) */
    static byte[] hkdf(byte[] salt, byte[] ikm, byte[] info, int length) throws GeneralSecurityException {
        byte[] prk = hmac(salt, ikm);
        byte[] okm = hmac(prk, concat(info, new byte[]{1}));
        return Arrays.copyOf(okm, length);
    }

    private static byte[] hmac(byte[] key, byte[] data) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(data);
    }

    // ───── RFC 8292 VAPID ─────

    /**
     * Authorization 헤더 값: "vapid t=<JWT>, k=<공개키>"
     *
     * @param audience 푸시 서비스 주소의 origin (예: https://fcm.googleapis.com)
     * @param subject  연락처 (mailto:... 또는 https://...)
     */
    public static String vapidAuthorization(String audience, String subject, long expiresAtEpochSec,
                                            byte[] vapidPublic, byte[] vapidPrivate) throws GeneralSecurityException {
        String header = encode("{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
        String claims = encode(("{\"aud\":\"" + jsonEscape(audience) + "\",\"exp\":" + expiresAtEpochSec
                + ",\"sub\":\"" + jsonEscape(subject) + "\"}").getBytes(StandardCharsets.UTF_8));
        String signingInput = header + "." + claims;

        Signature signer = Signature.getInstance("SHA256withECDSAinP1363Format"); // r||s 64바이트 (JWT ES256 형식)
        signer.initSign(privateKey(vapidPrivate));
        signer.update(signingInput.getBytes(StandardCharsets.US_ASCII));
        String jwt = signingInput + "." + encode(signer.sign());
        return "vapid t=" + jwt + ", k=" + encode(vapidPublic);
    }

    private static String jsonEscape(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    // ───── 공통 ─────

    static byte[] randomBytes(int n) {
        byte[] b = new byte[n];
        RANDOM.nextBytes(b);
        return b;
    }

    static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] p : parts) out.writeBytes(p);
        return out.toByteArray();
    }

    /** VAPID 키 만들기: 실행하면 환경변수에 넣을 값을 출력한다. */
    public static void main(String[] args) throws Exception {
        KeyPair kp = generateKeyPair();
        System.out.println("VAPID_PUBLIC_KEY=" + encode(raw((ECPublicKey) kp.getPublic())));
        System.out.println("VAPID_PRIVATE_KEY=" + encode(raw((ECPrivateKey) kp.getPrivate())));
    }
}
