<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
import RegisterForm from '../components/RegisterForm.vue'
import { useStackNavigation } from '../../../components/navigation/context'
const navigation = useStackNavigation()
</script>
<template>
  <div class="auth-page register-page">
    <div class="form-inner">
      <button class="back-link" data-motion type="button" :disabled="navigation.busy.value" @click="navigation.back()"><ArrowLeft :size="16" /> Đăng nhập</button>
      <h1 data-screen-title data-motion-text="title" data-motion-key="auth-title" tabindex="-1">Tạo tài khoản</h1>
      <RegisterForm />
    </div>
  </div>
</template>



