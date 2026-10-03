<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue'
import LoginForm from '../components/LoginForm.vue'
import { useStackNavigation } from '../../../components/navigation/context'
const navigation = useStackNavigation()
</script>
<template>
  <div class="auth-page login-page">
    <div class="form-inner">
      <h1 data-screen-title data-motion-text="title" data-motion-key="auth-title" tabindex="-1">Đăng nhập</h1>
      <LoginForm />
      <p class="switch-page" data-motion>Chưa có tài khoản? <button type="button" class="text-link" :disabled="navigation.busy.value" @click="navigation.push('/register')">Đăng ký <ArrowUpRight :size="15" /></button></p>
    </div>
  </div>
</template>



