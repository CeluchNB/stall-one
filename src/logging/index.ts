import winston from 'winston'
import { LoggingWinston } from '@google-cloud/logging-winston'
import { ApiError } from '../types/errors'
import { Request, Response, NextFunction } from 'express'
import { v4 as uuid } from 'uuid'

interface UniqueRequest extends Request {
    uuid: string
}

export const Logger = () => {
    const projectId = process.env.GCP_PROJECT_ID
    const loggingWinston = new LoggingWinston({ projectId, logName: 'stall-one' })
    const logger = winston.createLogger({
        level: 'http',
        format: winston.format.json(),
        transports: [new winston.transports.Console(), loggingWinston],
    })

    const requestMiddleware = (req: UniqueRequest, res: Response, next: NextFunction) => {
        req.uuid = uuid()
        logger.info(`${req.url} - ${req.uuid}`, {
            httpRequest: {
                statusCode: res.statusCode,
                requestUrl: req.url,
                requestMethod: req.method,
                body: req.body,
                requestId: req.uuid,
            },
        })
        next()
    }

    const errorMiddleware = (err: ApiError, req: UniqueRequest, res: Response, next: NextFunction) => {
        logger.error(`${req.url} - ${req.uuid}`, {
            httpRequest: {
                statusCode: res.statusCode,
                requestUrl: req.url,
                requestMethod: req.method,
                body: req.body,
                requestId: req.uuid,
            },
        })
        next(err)
    }

    const logRequest = (info: string) => {
        logger.info(info)
    }

    const logError = (error: ApiError) => {
        logger.error(error)
    }

    const logResult = (result: unknown) => {
        logger.info(result)
    }

    return {
        requestMiddleware,
        errorMiddleware,
        logRequest,
        logError,
        logResult,
    }
}
