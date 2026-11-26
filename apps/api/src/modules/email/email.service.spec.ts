import { Test, TestingModule } from '@nestjs/testing'
import { Transporter } from 'nodemailer'
import { EmailService } from './email.service'

describe('emailService', () => {
  let service: EmailService
  let mockTransporter: Partial<Transporter>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService],
    }).compile()

    service = module.get<EmailService>(EmailService)

    // Create mock transporter
    mockTransporter = {
      sendMail: vi.fn(),
      verify: vi.fn(),
    }
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('sendEmail', () => {
    it('should send an email with correct parameters', async () => {
      const emailOptions = {
        to: 'test@example.com',
        subject: 'Test Subject',
        content: 'Test content',
      }

      // Mock the transporter to avoid actual email sending in tests
      const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-message-id' })
      mockTransporter.sendMail = mockSendMail

      // Use Object.defineProperty to mock the private transporter
      Object.defineProperty(service, 'transporter', {
        value: mockTransporter,
        writable: true,
      })

      await service.sendEmail(emailOptions)

      expect(mockSendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: emailOptions.to,
        subject: emailOptions.subject,
        text: emailOptions.content,
        html: emailOptions.content,
      })
    })

    it('should send an email with HTML content when provided', async () => {
      const emailOptions = {
        to: 'test@example.com',
        subject: 'Test Subject',
        content: 'Test content',
        html: '<h1>Test HTML</h1>',
      }

      const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-message-id' })
      mockTransporter.sendMail = mockSendMail

      Object.defineProperty(service, 'transporter', {
        value: mockTransporter,
        writable: true,
      })

      await service.sendEmail(emailOptions)

      expect(mockSendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: emailOptions.to,
        subject: emailOptions.subject,
        text: emailOptions.content,
        html: emailOptions.html,
      })
    })
  })

  describe('sendEmail with copies and attachments', () => {
    function useMockTransport(): ReturnType<typeof vi.fn> {
      const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-message-id' })
      mockTransporter.sendMail = mockSendMail
      Object.defineProperty(service, 'transporter', { value: mockTransporter, writable: true })
      return mockSendMail
    }

    it('passes the copies and the attachments to the transport as they are', async () => {
      const mockSendMail = useMockTransport()
      const attachments = [
        { filename: 'commande.csv', content: 'a;b\n1;2', contentType: 'text/csv' },
      ]

      await service.sendEmail({
        to: 'supplier@example.com',
        cc: ['referent@example.com'],
        subject: 'Commande',
        content: 'Bonjour',
        attachments,
      })

      expect(mockSendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: 'supplier@example.com',
        cc: ['referent@example.com'],
        subject: 'Commande',
        text: 'Bonjour',
        html: 'Bonjour',
        attachments,
      })
    })

    it('leaves the copy and the attachments out of the message when there are none', async () => {
      const mockSendMail = useMockTransport()

      await service.sendEmail({
        to: 'a@example.com',
        cc: [],
        subject: 'S',
        content: 'C',
        attachments: [],
      })

      const sent = mockSendMail.mock.calls[0][0]
      expect(sent).not.toHaveProperty('cc')
      expect(sent).not.toHaveProperty('attachments')
    })
  })

  describe('sender and inline logo', () => {
    function useMockTransport(): ReturnType<typeof vi.fn> {
      const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-message-id' })
      mockTransporter.sendMail = mockSendMail
      Object.defineProperty(service, 'transporter', { value: mockTransporter, writable: true })
      return mockSendMail
    }

    it("sends from the cooperative's name", async () => {
      const mockSendMail = useMockTransport()

      await service.sendEmail({ to: 'a@example.com', subject: 'S', content: 'C' })

      expect(mockSendMail.mock.calls[0][0].from).toMatch(/^"Lay'picerie" <.+@.+>$/)
    })

    it('adds the logo after the attachments of the caller when the HTML shows it', async () => {
      const mockSendMail = useMockTransport()
      const csv = { filename: 'commande.csv', content: 'a;b', contentType: 'text/csv' }

      await service.sendEmail({
        to: 'a@example.com',
        subject: 'S',
        content: 'C',
        html: '<img src="cid:logo@grocery" alt="x">',
        attachments: [csv],
      })

      const { attachments } = mockSendMail.mock.calls[0][0]
      expect(attachments).toHaveLength(2)
      expect(attachments[0]).toBe(csv)
      expect(attachments[1]).toEqual({
        filename: 'logo.jpg',
        path: expect.stringMatching(/templates[\\/]static[\\/]logo\.jpg$/),
        cid: 'logo@grocery',
        contentType: 'image/jpeg',
      })
    })

    it('adds no logo when the HTML does not show it', async () => {
      const mockSendMail = useMockTransport()

      await service.sendEmail({
        to: 'a@example.com',
        subject: 'S',
        content: 'C',
        html: '<p>Bonjour</p>',
      })

      expect(mockSendMail.mock.calls[0][0]).not.toHaveProperty('attachments')
    })
  })

  describe('verifyConnection', () => {
    it('should return true when connection is verified', async () => {
      const mockVerify = vi.fn().mockResolvedValue(true)
      mockTransporter.verify = mockVerify

      Object.defineProperty(service, 'transporter', {
        value: mockTransporter,
        writable: true,
      })

      const result = await service.verifyConnection()

      expect(result).toBe(true)
      expect(mockVerify).toHaveBeenCalled()
    })

    it('should return false when connection verification fails', async () => {
      const mockVerify = vi.fn().mockRejectedValue(new Error('Connection failed'))
      mockTransporter.verify = mockVerify

      Object.defineProperty(service, 'transporter', {
        value: mockTransporter,
        writable: true,
      })

      const result = await service.verifyConnection()

      expect(result).toBe(false)
      expect(mockVerify).toHaveBeenCalled()
    })
  })
})
