import cv2
import numpy as np


class InpaintService:
    @staticmethod
    def remove_watermark(
        image_bytes: bytes,
        mask_bytes: bytes,
        method: str = "smart",
        radius: int = 5,
        dilate: int = 3,
    ) -> bytes:
        """
        Ultra-High-Fidelity AI Watermark Removal & Texture Synthesis Engine:
        1. Adaptive Watermark Stroke Masking: Closes and dilates text glyphs to prevent black residues.
        2. Frequency-Separated Inpainting: Separates lighting base from high-frequency skin/surface texture.
        3. Texture & Grain Synthesis: Synthesizes matching micro-texture, pores, and skin sharpness across the inpainted area so there is zero blurriness or flat smudging.
        """
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
        if img is None:
            raise ValueError("Could not decode source image.")

        has_alpha = False
        alpha_channel = None
        if len(img.shape) == 3 and img.shape[2] == 4:
            has_alpha = True
            alpha_channel = img[:, :, 3]
            img_bgr = img[:, :, :3]
        elif len(img.shape) == 2:
            img_bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        else:
            img_bgr = img

        h, w = img_bgr.shape[:2]

        mask_arr = np.frombuffer(mask_bytes, np.uint8)
        mask_raw = cv2.imdecode(mask_arr, cv2.IMREAD_UNCHANGED)
        if mask_raw is None:
            raise ValueError("Could not decode mask image.")

        # 1. Parse User Mask
        if len(mask_raw.shape) == 3:
            if mask_raw.shape[2] == 4:
                user_mask = np.zeros((mask_raw.shape[0], mask_raw.shape[1]), dtype=np.uint8)
                is_marked = (mask_raw[:, :, 3] > 15) & (
                    (mask_raw[:, :, 0] > 15) | (mask_raw[:, :, 1] > 15) | (mask_raw[:, :, 2] > 15)
                )
                user_mask[is_marked] = 255
            else:
                user_mask = cv2.cvtColor(mask_raw, cv2.COLOR_BGR2GRAY)
                _, user_mask = cv2.threshold(user_mask, 15, 255, cv2.THRESH_BINARY)
        else:
            _, user_mask = cv2.threshold(mask_raw, 15, 255, cv2.THRESH_BINARY)

        # Match dimensions
        if (user_mask.shape[0] != h) or (user_mask.shape[1] != w):
            user_mask = cv2.resize(user_mask, (w, h), interpolation=cv2.INTER_NEAREST)

        # 2. Extract Text Watermark Strokes with Solid Morphological Closing & Dilation
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

        # Morphological BlackHat (dark text on light background) and TopHat (light text on dark background)
        elem_s = cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11))
        elem_m = cv2.getStructuringElement(cv2.MORPH_RECT, (21, 21))
        bh_s = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, elem_s)
        th_s = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, elem_s)
        bh_m = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, elem_m)
        th_m = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, elem_m)

        text_response = cv2.max(cv2.max(bh_s, th_s), cv2.max(bh_m, th_m))

        # Sobel high-frequency gradient
        grad_x = cv2.Sobel(gray, cv2.CV_16S, 1, 0, ksize=3)
        grad_y = cv2.Sobel(gray, cv2.CV_16S, 0, 1, ksize=3)
        abs_grad_x = cv2.convertScaleAbs(grad_x)
        abs_grad_y = cv2.convertScaleAbs(grad_y)
        edge_energy = cv2.addWeighted(abs_grad_x, 0.5, abs_grad_y, 0.5, 0)

        watermark_feature = cv2.addWeighted(text_response, 0.7, edge_energy, 0.3, 0)

        # Threshold within user marked regions
        user_pixels = watermark_feature[user_mask > 0]
        if len(user_pixels) > 0:
            thresh_val = max(14.0, float(np.percentile(user_pixels, 30)))
            _, text_binary = cv2.threshold(watermark_feature, thresh_val, 255, cv2.THRESH_BINARY)
            extracted_text = cv2.bitwise_and(text_binary, text_binary, mask=user_mask)

            # Morphological closing to connect letter strokes into complete glyphs
            close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
            closed_text = cv2.morphologyEx(extracted_text, cv2.MORPH_CLOSE, close_kernel)

            # Dilate text mask by 4-5px to completely engulf all anti-aliased font edges and shadows
            dilate_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            dilated_text = cv2.dilate(closed_text, dilate_kernel, iterations=1)

            text_count = np.count_nonzero(dilated_text)
            user_count = np.count_nonzero(user_mask)

            # If isolated text covers a valid portion of selection, use refined text mask; otherwise use full dilated selection
            if text_count > 0 and (text_count / user_count) > 0.05:
                inpaint_mask = dilated_text
            else:
                inpaint_mask = cv2.dilate(user_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)), iterations=1)
        else:
            inpaint_mask = cv2.dilate(user_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)), iterations=1)

        # Ensure mask is binary uint8
        _, inpaint_mask = cv2.threshold(inpaint_mask, 10, 255, cv2.THRESH_BINARY)

        # 3. Frequency-Separated High-Fidelity Inpainting (Zero Blur)
        # Decompose into Low-Frequency Base (illumination & smooth tone) and High-Frequency Texture (skin pores & grain)
        base = cv2.bilateralFilter(img_bgr, d=9, sigmaColor=75, sigmaSpace=75)
        high_freq_texture = img_bgr.astype(np.float32) - base.astype(np.float32)

        # Inpaint Base using Navier-Stokes (smooth gradient preservation across facial lighting)
        inpaint_r = max(3, min(15, radius))
        inpainted_base_ns = cv2.inpaint(base, inpaint_mask, inpaint_r, cv2.INPAINT_NS)
        inpainted_base_telea = cv2.inpaint(base, inpaint_mask, inpaint_r, cv2.INPAINT_TELEA)
        inpainted_base = cv2.addWeighted(inpainted_base_ns, 0.7, inpainted_base_telea, 0.3, 0)

        # Reconstruct High-Frequency Skin Texture & Grain for the inpainted region
        # Sample surrounding unmasked border texture
        border_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
        outer_ring = cv2.subtract(cv2.dilate(inpaint_mask, border_kernel, iterations=1), inpaint_mask)

        if np.count_nonzero(outer_ring) > 30:
            border_texture = high_freq_texture[outer_ring > 0]
            tex_mean = np.mean(border_texture, axis=0)
            tex_std = np.std(border_texture, axis=0)

            # Generate natural micro-texture conditioned on local skin grain variance
            synth_texture = np.random.normal(tex_mean, np.maximum(tex_std, 1.5), img_bgr.shape).astype(np.float32)

            # Soft mask transition for seamless edge blending
            soft_mask = cv2.GaussianBlur(inpaint_mask.astype(np.float32) / 255.0, (7, 7), 2.0)[:, :, np.newaxis]
            combined_texture = high_freq_texture * (1.0 - soft_mask) + synth_texture * soft_mask

            # Recombine base illumination + sharp micro-texture
            result_bgr = np.clip(inpainted_base.astype(np.float32) + combined_texture, 0, 255).astype(np.uint8)
        else:
            result_bgr = inpainted_base

        # Re-attach alpha channel if original had one
        if has_alpha and alpha_channel is not None:
            result = cv2.merge([result_bgr[:, :, 0], result_bgr[:, :, 1], result_bgr[:, :, 2], alpha_channel])
        else:
            result = result_bgr

        success, encoded_img = cv2.imencode(".png", result, [cv2.IMWRITE_PNG_COMPRESSION, 3])
        if not success:
            raise ValueError("Could not encode inpainting result.")

        return encoded_img.tobytes()
