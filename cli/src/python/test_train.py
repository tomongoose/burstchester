import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import train


class _CudaAvailable:
    @staticmethod
    def is_available():
        return True


class _CudaUnavailable:
    @staticmethod
    def is_available():
        return False


class _TorchWithCuda:
    float16 = "float16"
    float32 = "float32"
    cuda = _CudaAvailable()


class _TorchWithoutCuda:
    float16 = "float16"
    float32 = "float32"
    cuda = _CudaUnavailable()


class TrainNotebookParityTests(unittest.TestCase):
    def test_gemma_uses_notebook_lora_target_modules(self):
        self.assertEqual(
            train.resolve_lora_target_modules("google/gemma-2b-it"),
            ["q_proj", "v_proj"],
        )

    def test_non_gemma_keeps_broader_lora_target_modules(self):
        self.assertEqual(
            train.resolve_lora_target_modules("Qwen/Qwen3-0.6B"),
            ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        )

    def test_gemma_lora_loads_with_auto_device_map_and_half_precision_when_cuda_exists(self):
        self.assertEqual(
            train.resolve_model_load_kwargs(
                model_repo="google/gemma-2b-it",
                training_method="lora",
                torch_module=_TorchWithCuda(),
            ),
            {
                "trust_remote_code": True,
                "device_map": "auto",
                "torch_dtype": "float16",
            },
        )

    def test_gemma_lora_falls_back_to_float32_without_cuda(self):
        self.assertEqual(
            train.resolve_model_load_kwargs(
                model_repo="google/gemma-2b-it",
                training_method="lora",
                torch_module=_TorchWithoutCuda(),
            ),
            {
                "trust_remote_code": True,
                "device_map": "auto",
                "torch_dtype": "float32",
            },
        )


if __name__ == "__main__":
    unittest.main()
