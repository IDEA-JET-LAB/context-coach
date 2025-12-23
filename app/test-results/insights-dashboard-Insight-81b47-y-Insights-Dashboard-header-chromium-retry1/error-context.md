# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - generic [ref=e7]: Sign up
      - generic [ref=e8]: Create a new account
    - generic [ref=e10]:
      - alert [ref=e11]:
        - generic [ref=e12]: Too many attempts. Please try again later.
      - generic [ref=e13]:
        - generic [ref=e14]: Email
        - textbox "Email" [ref=e15]:
          - /placeholder: m@example.com
          - text: test-1766526258831-ognlwk@example.com
      - generic [ref=e16]:
        - generic [ref=e17]: Password
        - textbox "Password" [ref=e18]: TestPassword123!
      - generic [ref=e19]:
        - generic [ref=e20]: Confirm Password
        - textbox "Confirm Password" [ref=e21]: TestPassword123!
      - button "Create account" [ref=e22] [cursor=pointer]
      - generic [ref=e23]:
        - text: Already have an account?
        - link "Login" [ref=e24] [cursor=pointer]:
          - /url: /login
      - generic [ref=e29]: Or continue with
      - button "Continue with Google" [ref=e30] [cursor=pointer]:
        - img
        - text: Continue with Google
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e36] [cursor=pointer]:
    - img [ref=e37]
  - alert [ref=e40]
```