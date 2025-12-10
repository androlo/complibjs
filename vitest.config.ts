// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',      // or 'jsdom' if you tests DOM APIs
        include: ['tests/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reportsDirectory: './coverage',
            reporter: ['text', 'html'],
            include: ['tests/**/*.test.ts']
        }
    }
});